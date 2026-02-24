import os
from fastapi import Header, HTTPException
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

_supabase: Client | None = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    _supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def verify_supabase_jwt(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = authorization.split(" ", 1)[1].strip()

    if not _supabase:
        raise HTTPException(status_code=500, detail="Supabase server client not configured")

    try:
        # Server-side validation via Supabase Auth
        user_resp = _supabase.auth.get_user(token)
        user = user_resp.user
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")

        return {
            "sub": user.id,
            "email": user.email,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")