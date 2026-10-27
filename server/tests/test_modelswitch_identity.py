import asyncio
from uuid import UUID

import httpx
import pytest

from app.domains.user.modelswitch_identity import (
    IdentityRejected,
    IdentityServiceUnavailable,
    authenticate_modelswitch,
    get_modelswitch_security_config,
    verify_modelswitch_identity,
)


def verify(token, handler):
    return asyncio.run(verify_modelswitch_identity(token, transport=httpx.MockTransport(handler)))


def test_verified_account_uses_stable_local_identity():
    account_id = "57d309d0-43fd-4d64-a764-625f7903c105"

    def handler(request):
        assert str(request.url) == "https://api.modelswitch.org/api/auth/me"
        assert request.headers["authorization"] == "Bearer test-token"
        return httpx.Response(200, json={"id": account_id, "is_active": True})

    identity = verify("test-token", handler)
    assert identity.id == UUID(account_id)
    assert identity.local_key == f"modelswitch:{account_id}"
    assert identity.local_email == f"{UUID(account_id).hex}@accounts.modelswitch.org"


@pytest.mark.parametrize("status", [401, 403])
def test_rejected_token(status):
    with pytest.raises(IdentityRejected):
        verify("invalid", lambda request: httpx.Response(status))


@pytest.mark.parametrize("token", ["", "bearer\nother", "x" * 8193])
def test_malformed_token_never_sent(token):
    def handler(request):
        pytest.fail("malformed token was sent")

    with pytest.raises(IdentityRejected):
        verify(token, handler)


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(302, headers={"location": "https://example.com"}),
        httpx.Response(500),
        httpx.Response(200, json={"id": "invalid", "is_active": True}),
        httpx.Response(200, json={"id": "57d309d0-43fd-4d64-a764-625f7903c105", "is_active": False}),
        httpx.Response(200, text="invalid json"),
    ],
)
def test_service_failures_do_not_authenticate(response):
    with pytest.raises(IdentityServiceUnavailable):
        verify("test-token", lambda request: response)


def test_network_failure_does_not_authenticate():
    def handler(request):
        raise httpx.ConnectError("connection failed", request=request)

    with pytest.raises(IdentityServiceUnavailable):
        verify("test-token", handler)


def test_password_login_verifies_token_with_account_service():
    calls = []

    def handler(request):
        calls.append(request)
        if request.url.path == "/api/auth/login":
            assert request.read() == b'{"username":"alice","password":"password","turnstile_token":"challenge"}'
            return httpx.Response(200, json={"access_token": "short-lived-token"})
        assert request.url.path == "/api/auth/me"
        assert request.headers["authorization"] == "Bearer short-lived-token"
        return httpx.Response(200, json={"id": "57d309d0-43fd-4d64-a764-625f7903c105", "is_active": True})

    identity = asyncio.run(
        authenticate_modelswitch("alice", "password", "challenge", transport=httpx.MockTransport(handler))
    )
    assert identity.id == UUID("57d309d0-43fd-4d64-a764-625f7903c105")
    assert len(calls) == 2
    assert "short-lived-token" not in repr(identity)


def test_security_config_fails_closed():
    async def read(response):
        return await get_modelswitch_security_config(transport=httpx.MockTransport(lambda request: response))

    assert asyncio.run(read(httpx.Response(200, json={"turnstile_required": False}))) == {
        "turnstile_required": False,
        "turnstile_site_key": "",
    }
    with pytest.raises(IdentityServiceUnavailable):
        asyncio.run(read(httpx.Response(200, json={"turnstile_required": True})))
    with pytest.raises(IdentityServiceUnavailable):
        asyncio.run(read(httpx.Response(500)))
