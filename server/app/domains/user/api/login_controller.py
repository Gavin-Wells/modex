# ========= Copyright 2025-2026 @ Eigent.ai All Rights Reserved. =========
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ========= Copyright 2025-2026 @ Eigent.ai All Rights Reserved. =========

"""ModelSwitch account verification for local workspace sessions.

Modified for Modex account verification.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlmodel import Session

from app.core.database import session
from app.domains.user.modelswitch_identity import (
    IdentityRejected,
    IdentityServiceUnavailable,
    authenticate_modelswitch,
    get_modelswitch_security_config,
    verify_modelswitch_identity,
)
from app.domains.user.modelswitch_local_user import LocalIdentityBlocked, get_or_create_local_user
from app.model.user.user import LoginResponse
from app.shared.auth import create_access_token

router = APIRouter(prefix="/user", tags=["V1 Login"])
modelswitch_bearer = HTTPBearer(auto_error=False)


@router.post("/auto-login", name="auto login for local mode")
async def auto_login() -> LoginResponse:
    """Reject legacy clients that previously bypassed account verification."""
    raise HTTPException(status_code=403, detail="ModelSwitch account required")


@router.post("/modelswitch-login", name="login with ModelSwitch account")
async def modelswitch_login(
    credentials: HTTPAuthorizationCredentials | None = Depends(modelswitch_bearer),
    db_session: Session = Depends(session),
) -> LoginResponse:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="ModelSwitch account token required")
    try:
        identity = await verify_modelswitch_identity(credentials.credentials)
        user = get_or_create_local_user(db_session, identity)
    except IdentityRejected as exc:
        raise HTTPException(status_code=401, detail="ModelSwitch account token rejected") from exc
    except IdentityServiceUnavailable as exc:
        raise HTTPException(status_code=503, detail="ModelSwitch account service unavailable") from exc
    except LocalIdentityBlocked as exc:
        raise HTTPException(status_code=403, detail="Local account is blocked") from exc
    return LoginResponse(token=create_access_token(user.id), email=user.email, user_id=user.id)


class ModelSwitchPasswordLogin(BaseModel):
    username: str
    password: str
    turnstile_token: str = ""


@router.get("/modelswitch-security-config", name="ModelSwitch login security settings")
async def modelswitch_security_config() -> dict:
    try:
        return await get_modelswitch_security_config()
    except IdentityServiceUnavailable as exc:
        raise HTTPException(status_code=503, detail="ModelSwitch 账号服务暂时不可用") from exc


@router.post("/modelswitch-password-login", name="login with ModelSwitch password")
async def modelswitch_password_login(
    data: ModelSwitchPasswordLogin,
    db_session: Session = Depends(session),
) -> LoginResponse:
    try:
        identity = await authenticate_modelswitch(data.username, data.password, data.turnstile_token)
        user = get_or_create_local_user(db_session, identity)
    except IdentityRejected as exc:
        raise HTTPException(status_code=401, detail="账号验证失败，请检查账号、密码或人机验证") from exc
    except IdentityServiceUnavailable as exc:
        raise HTTPException(status_code=503, detail="ModelSwitch 账号服务暂时不可用") from exc
    except LocalIdentityBlocked as exc:
        raise HTTPException(status_code=403, detail="本地账号已停用") from exc
    return LoginResponse(token=create_access_token(user.id), email=user.email, user_id=user.id)
