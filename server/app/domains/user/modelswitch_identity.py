"""Verify ModelSwitch accounts without persisting their access tokens."""

from dataclasses import dataclass
from uuid import UUID

import httpx

MODELSWITCH_PROFILE_URL = "https://api.modelswitch.org/api/auth/me"
MODELSWITCH_LOGIN_URL = "https://api.modelswitch.org/api/auth/login"
MODELSWITCH_SECURITY_URL = "https://api.modelswitch.org/api/auth/security-config"


class IdentityRejected(Exception):
    """The supplied account token is invalid or the account is unavailable."""


class IdentityServiceUnavailable(Exception):
    """The account service could not verify the identity."""


@dataclass(frozen=True)
class ModelSwitchIdentity:
    id: UUID

    @property
    def local_key(self) -> str:
        return f"modelswitch:{self.id}"

    @property
    def local_email(self) -> str:
        # A stable local identifier, not an address used to contact the user.
        return f"{self.id.hex}@accounts.modelswitch.org"


async def get_modelswitch_security_config(*, transport: httpx.AsyncBaseTransport | None = None) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10, transport=transport, follow_redirects=False) as client:
            response = await client.get(MODELSWITCH_SECURITY_URL)
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict) or not isinstance(data.get("turnstile_required"), bool):
            raise ValueError("invalid security configuration")
        site_key = data.get("turnstile_site_key", "")
        if not isinstance(site_key, str) or (data["turnstile_required"] and not site_key):
            raise ValueError("invalid security configuration")
        return {"turnstile_required": data["turnstile_required"], "turnstile_site_key": site_key}
    except (httpx.HTTPError, TypeError, ValueError) as exc:
        raise IdentityServiceUnavailable() from exc


async def verify_modelswitch_identity(
    token: str, *, transport: httpx.AsyncBaseTransport | None = None
) -> ModelSwitchIdentity:
    if not token or len(token) > 8192 or any(c.isspace() for c in token):
        raise IdentityRejected()
    try:
        async with httpx.AsyncClient(timeout=10, transport=transport, follow_redirects=False) as client:
            response = await client.get(
                MODELSWITCH_PROFILE_URL,
                headers={"Authorization": f"Bearer {token}"},
            )
    except httpx.RequestError as exc:
        raise IdentityServiceUnavailable() from exc

    if response.status_code in (401, 403):
        raise IdentityRejected()
    if response.status_code != 200:
        raise IdentityServiceUnavailable()
    try:
        profile = response.json()
        if not isinstance(profile, dict) or profile.get("is_active") is not True:
            raise ValueError("inactive or invalid profile")
        return ModelSwitchIdentity(id=UUID(profile["id"]))
    except (KeyError, TypeError, ValueError) as exc:
        raise IdentityServiceUnavailable() from exc


async def authenticate_modelswitch(
    username: str,
    password: str,
    turnstile_token: str = "",
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> ModelSwitchIdentity:
    if not username.strip() or not password or len(username) > 128 or len(password) > 1024:
        raise IdentityRejected()
    try:
        async with httpx.AsyncClient(timeout=15, transport=transport, follow_redirects=False) as client:
            response = await client.post(
                MODELSWITCH_LOGIN_URL,
                json={"username": username.strip(), "password": password, "turnstile_token": turnstile_token},
            )
    except httpx.RequestError as exc:
        raise IdentityServiceUnavailable() from exc
    if response.status_code in (400, 401, 403, 429):
        raise IdentityRejected()
    if response.status_code != 200:
        raise IdentityServiceUnavailable()
    try:
        token = response.json()["access_token"]
        if not isinstance(token, str):
            raise ValueError("invalid access token")
    except (KeyError, TypeError, ValueError) as exc:
        raise IdentityServiceUnavailable() from exc
    return await verify_modelswitch_identity(token, transport=transport)
