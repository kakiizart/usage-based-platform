import hashlib
import secrets
from datetime import datetime, timezone
from fastapi import Depends, HTTPException
from pydantic import BaseModel

from .auth import verify_supabase_jwt
from .supabase_client import supabase

API_KEY_PREFIX = "ubp_"  # Usage-Based Platform


def hash_key(raw_key: str) -> str:
    # stable hash, store in DB (no secrets in DB)
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def make_raw_key() -> str:
    # urlsafe already base64-ish; keep it long enough
    return API_KEY_PREFIX + secrets.token_urlsafe(32)


class CreateKeyOut(BaseModel):
    api_key: str
    prefix: str


def create_api_key_for_user(user_id: str, name: str | None = None) -> CreateKeyOut:
    raw = make_raw_key()
    prefix = raw[:12]
    key_hash = hash_key(raw)

    supabase.table("api_keys").insert(
        {
            "user_id": user_id,
            "name": name,
            "prefix": prefix,
            "key_hash": key_hash,
        }
    ).execute()

    return CreateKeyOut(api_key=raw, prefix=prefix)