from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from services.jwt_auth import verify_token

_http_bearer = HTTPBearer(auto_error=False)

# Function to get the current user UID
def get_current_user_uid(
    cred: HTTPAuthorizationCredentials | None = Depends(_http_bearer),
) -> str:
    print(f"🔐 get_current_user_uid called, cred present: {cred is not None}")
    if not cred:
        print(f"❌ No credentials provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    print(f"🔐 Token received (first 20 chars): {cred.credentials[:20]}...")
    try:
        payload = verify_token(cred.credentials)
        print(f"✅ Token verified, payload: {payload}")
        uid = payload.get("sub")
        if not uid:
            print(f"❌ No 'sub' in token payload")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        print(f"✅ Returning uid: {uid}")
        return uid
    except Exception as e:
        print(f"❌ Token verification failed: {type(e).__name__}: {str(e)}")
        raise
