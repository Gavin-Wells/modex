"""Authenticate local desktop login requests and workspace readiness probes."""

import hashlib
import hmac
import re

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

CAPABILITY_HEADER = b"x-modex-workspace-capability"
READY_PREFIX = "/modex-local/ready/"
LOGIN_PREFIX = "/api/v1/user/modelswitch-"
_NONCE = re.compile(r"[0-9a-f]{64}\Z")


class ModexCapabilityMiddleware:
    def __init__(self, app: ASGIApp, capability: str):
        if len(capability) < 32:
            raise ValueError("Modex workspace capability is too short")
        self.app = app
        self._capability = capability.encode("utf-8")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path = scope.get("path", "")
        if path.startswith(READY_PREFIX):
            nonce = path[len(READY_PREFIX) :]
            if scope.get("method") != "GET" or not _NONCE.fullmatch(nonce):
                await JSONResponse({"detail": "Not found"}, status_code=404)(scope, receive, send)
                return
            digest = hmac.new(self._capability, ("modex-workspace:" + nonce).encode(), hashlib.sha256).hexdigest()
            await JSONResponse({"proof": digest}, headers={"Cache-Control": "no-store"})(scope, receive, send)
            return
        if path.startswith(LOGIN_PREFIX) and scope.get("method") != "OPTIONS":
            supplied = next((value for key, value in scope.get("headers", []) if key.lower() == CAPABILITY_HEADER), b"")
            if not hmac.compare_digest(supplied, self._capability):
                await JSONResponse({"detail": "Local workspace authorization required"}, status_code=403)(
                    scope, receive, send
                )
                return
        await self.app(scope, receive, send)
