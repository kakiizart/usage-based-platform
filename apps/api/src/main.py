import os
import hashlib
from datetime import datetime, timezone

import stripe
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from redis import Redis

from .auth import verify_supabase_jwt
from .supabase_client import supabase
from .api_keys import create_api_key_for_user

load_dotenv()

app = FastAPI(title="Usage-Based API Platform", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# Config / clients
# ----------------------------
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = Redis.from_url(REDIS_URL, decode_responses=True)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")

WEB_BASE_URL = os.getenv("WEB_BASE_URL", "http://localhost:3000")

STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID", "")
if not STRIPE_PRICE_ID:
    raise RuntimeError("Missing STRIPE_PRICE_ID in environment")

STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

# ----------------------------
# Models
# ----------------------------
class AnalyzeIn(BaseModel):
    text: str


class CreateApiKeyIn(BaseModel):
    name: str | None = None


# ----------------------------
# Helpers
# ----------------------------
def _ts_to_iso(ts: int | None):
    if not ts:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def upsert_subscription_row(user_id: str, sub: dict):
    price_id = None
    try:
        items = sub.get("items", {}).get("data", [])
        if items and items[0].get("price"):
            price_id = items[0]["price"].get("id")
    except Exception:
        pass

    payload = {
        "user_id": user_id,
        "stripe_subscription_id": sub.get("id"),
        "stripe_price_id": price_id,
        "status": sub.get("status"),
        "current_period_start": _ts_to_iso(sub.get("current_period_start")),
        "current_period_end": _ts_to_iso(sub.get("current_period_end")),
    }

    return (
        supabase.table("subscriptions")
        .upsert(payload, on_conflict="stripe_subscription_id")
        .execute()
    )


def _hash_api_key(raw_key: str) -> str:
    # MUST match api_keys.hash_key() (SHA256)
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def require_api_key(authorization: str | None) -> dict:
    """
    Expect: Authorization: Bearer <api_key>
    Returns api_keys row if valid.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=401, detail="Invalid Authorization format")

    raw_key = parts[1].strip()
    key_hash = _hash_api_key(raw_key)

    r = (
        supabase.table("api_keys")
        .select("id,user_id,is_active")
        .eq("key_hash", key_hash)
        .limit(1)
        .execute()
    )

    if not r.data:
        raise HTTPException(status_code=401, detail="Invalid API key")

    row = r.data[0]
    if row.get("is_active") is False:
        raise HTTPException(status_code=403, detail="API key is disabled")

    return row


def user_has_active_subscription(user_id: str) -> bool:
    """
    Returns True if the user has at least one subscription
    with status active or trialing.
    """
    r = (
        supabase.table("subscriptions")
        .select("status")
        .eq("user_id", user_id)
        .execute()
    )

    if not r.data:
        return False

    allowed_statuses = {"active", "trialing"}

    for row in r.data:
        status = (row.get("status") or "").strip().lower()
        if status in allowed_statuses:
            return True

    return False


# ----------------------------
# Routes
# ----------------------------
@app.get("/v1/health")
def health():
    return {"ok": True, "env": os.getenv("APP_ENV", "dev")}


@app.get("/v1/me")
def me(user=Depends(verify_supabase_jwt)):
    return {"user_id": user.get("sub"), "email": user.get("email")}


@app.post("/v1/api-keys")
def create_api_key(payload: CreateApiKeyIn, user=Depends(verify_supabase_jwt)):
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid auth session")
    # IMPORTANT: the *real* key is only returned here (not stored in DB)
    return create_api_key_for_user(user_id, payload.name)


@app.post("/v1/analyze")
def analyze(
    payload: AnalyzeIn,
    authorization: str | None = Header(default=None),
):
    # Step 4: enforce API key
    key_row = require_api_key(authorization)
    user_id = key_row["user_id"]

    # Step A: enforce active subscription
    if not user_has_active_subscription(user_id):
        raise HTTPException(status_code=402, detail="Active subscription required")

    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="text is required")

    # Tie usage to the API key owner
    redis_client.incr("usage:requests_total")
    redis_client.incr(f"usage:user:{user_id}:requests_total")

    word_count = len(payload.text.split())
    char_count = len(payload.text)

    return {
        "result": {"word_count": word_count, "char_count": char_count},
        "request_id": redis_client.incr("req:id"),
    }


@app.post("/v1/billing/checkout-session")
def create_checkout_session(user=Depends(verify_supabase_jwt)):
    if not supabase:
        raise HTTPException(
            status_code=500, detail="Supabase server client not configured"
        )

    user_id = user.get("sub")
    email = user.get("email")
    if not user_id or not email:
        raise HTTPException(status_code=401, detail="Invalid auth session")

    existing = supabase.table("app_users").select("*").eq("id", user_id).execute()
    row = existing.data[0] if existing.data else None

    if not row:
        supabase.table("app_users").insert({"id": user_id, "email": email}).execute()
        row = {"id": user_id, "email": email, "stripe_customer_id": None}

    stripe_customer_id = row.get("stripe_customer_id")
    if not stripe_customer_id:
        customer = stripe.Customer.create(
            email=email, metadata={"supabase_user_id": user_id}
        )
        stripe_customer_id = customer["id"]
        supabase.table("app_users").update(
            {"stripe_customer_id": stripe_customer_id}
        ).eq("id", user_id).execute()

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": STRIPE_PRICE_ID, "quantity": 1}],
        success_url=f"{WEB_BASE_URL}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{WEB_BASE_URL}/billing/cancel",
        customer=stripe_customer_id,
        metadata={"user_id": user_id},
        subscription_data={"metadata": {"user_id": user_id}},
    )

    return {"url": session.url}


@app.post("/v1/stripe/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Missing STRIPE_WEBHOOK_SECRET")

    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=stripe_signature,
            secret=STRIPE_WEBHOOK_SECRET,
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Webhook signature verification failed: {str(e)}",
        )

    event_type = event["type"]

    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = (session.get("metadata") or {}).get("user_id")
        customer_id = session.get("customer")
        subscription_id = session.get("subscription")

        if not user_id and customer_id:
            r = (
                supabase.table("app_users")
                .select("id")
                .eq("stripe_customer_id", customer_id)
                .limit(1)
                .execute()
            )
            if r.data:
                user_id = r.data[0]["id"]

        if not user_id:
            return {"received": True, "type": event_type, "note": "No user_id found"}

        if subscription_id:
            sub = stripe.Subscription.retrieve(
                subscription_id,
                expand=["items.data.price"],
            )
            upsert_subscription_row(user_id, sub)
            return {"received": True, "type": event_type}

        return {
            "received": True,
            "type": event_type,
            "note": "No subscription on session",
        }

    if event_type in ("customer.subscription.updated", "customer.subscription.deleted"):
        sub = event["data"]["object"]
        customer_id = sub.get("customer")
        user_id = (sub.get("metadata") or {}).get("user_id")

        if not user_id and customer_id:
            r = (
                supabase.table("app_users")
                .select("id")
                .eq("stripe_customer_id", customer_id)
                .limit(1)
                .execute()
            )
            if r.data:
                user_id = r.data[0]["id"]

        if user_id:
            upsert_subscription_row(user_id, sub)

        return {"received": True, "type": event_type}

    return {"received": True, "type": event_type}