import asyncio
import hashlib
import hmac

import httpx
from fastapi import FastAPI

from app.shared.middleware.modex_capability import ModexCapabilityMiddleware


def test_local_service_challenge_and_login_capability():
    capability = "test-secret-that-is-at-least-32-bytes"
    app = FastAPI()
    app.add_middleware(ModexCapabilityMiddleware, capability=capability)

    @app.post("/api/v1/user/modelswitch-password-login")
    async def login():
        return {"ok": True}

    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            nonce = "ab" * 32
            response = await client.get("/modex-local/ready/" + nonce)
            expected = hmac.new(capability.encode(), ("modex-workspace:" + nonce).encode(), hashlib.sha256).hexdigest()
            assert response.json() == {"proof": expected}
            assert response.headers["cache-control"] == "no-store"
            assert (await client.get("/modex-local/ready/bad")).status_code == 404
            path = "/api/v1/user/modelswitch-password-login"
            assert (await client.post(path)).status_code == 403
            assert (await client.post(path, headers={"X-Modex-Workspace-Capability": "incorrect"})).status_code == 403
            assert (await client.post(path, headers={"X-Modex-Workspace-Capability": capability})).status_code == 200

    asyncio.run(run())
