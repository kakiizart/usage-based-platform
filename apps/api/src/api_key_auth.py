import hashlib
from fastapi import Header, HTTPException

from .supabase_client import supabase


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def require_api_key(authorization: str | None) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=401, detail="Invalid Authorization format")

    raw_key = parts[1].strip()
    key_hash = _hash_api_key(raw_key)

    r = (
        supabase.table("api_keys")
        .select("*")  # <= safest while schema is still evolving
        .eq("key_hash", key_hash)
        .limit(1)
        .execute()
    )

    # Supabase python clients often expose errors on the response
    err = getattr(r, "error", None)
    if err:
        raise HTTPException(status_code=500, detail=f"Supabase error: {err}")

    data = getattr(r, "data", None) or []
    if not data:
        raise HTTPException(status_code=401, detail="Invalid API key")

    row = data[0]
    if row.get("is_active") is False:
        raise HTTPException(status_code=403, detail="API key is disabled")

    return row