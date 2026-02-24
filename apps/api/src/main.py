import os
import stripe
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from redis import Redis
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="Usage-Based API Platform", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = Redis.from_url(REDIS_URL, decode_responses=True)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")

WEB_BASE_URL = os.getenv("WEB_BASE_URL", "http://localhost:3000")
PRICE_ID = os.getenv("STRIPE_PRICE_ID", "")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")


class AnalyzeIn(BaseModel):
    text: str


@app.get("/v1/health")
def health():
    return {"ok": True, "env": os.getenv("APP_ENV", "dev")}


# --- Product API endpoint (will be protected by API keys next) ---
@app.post("/v1/analyze")
def analyze(payload: AnalyzeIn, authorization: str | None = Header(default=None)):
    # Placeholder for API key auth (Sprint 2)
    # Example: Authorization: Bearer <api_key>
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="text is required")

    # Placeholder usage counter (we’ll tie to user + Stripe later)
    redis_client.incr("usage:requests_total")

    # Tiny “real” behavior to demo
    word_count = len(payload.text.split())
    char_count = len(payload.text)
    return {
        "result": {"word_count": word_count, "char_count": char_count},
        "request_id": redis_client.incr("req:id"),
    }


# --- Billing: create Stripe Checkout Session (subscription) ---
@app.post("/v1/billing/checkout-session")
def create_checkout_session():
    if not PRICE_ID:
        raise HTTPException(status_code=500, detail="Missing STRIPE_PRICE_ID in env")

    # NOTE: in Sprint 1 we’ll attach this to an authenticated user + Stripe customer.
    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": PRICE_ID, "quantity": 1}],
        success_url=f"{WEB_BASE_URL}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{WEB_BASE_URL}/billing/cancel",
    )
    return {"url": session.url}


# --- Webhooks: Stripe events (signature verification hook) ---
@app.post("/v1/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not WEBHOOK_SECRET:
        # Safe fail: don’t accept webhooks without a secret configured
        raise HTTPException(status_code=500, detail="Missing STRIPE_WEBHOOK_SECRET in env")

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=WEBHOOK_SECRET,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)}")

    # TODO Sprint 1: handle subscription lifecycle events
    # Examples: customer.subscription.created/updated/deleted, invoice.paid, invoice.payment_failed
    event_type = event.get("type", "unknown")
    redis_client.incr(f"stripe:webhook:{event_type}")

    return {"received": True, "type": event_type}