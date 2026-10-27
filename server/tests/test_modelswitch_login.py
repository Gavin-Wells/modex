import asyncio
from uuid import UUID

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import Session

from app.core.database import session
from app.domains.user.api import login_controller
from app.domains.user.modelswitch_identity import IdentityRejected, ModelSwitchIdentity
from app.model.user.user import User
from app.shared.auth import user_auth
from app.shared.exception import TokenException


def test_login_maps_verified_identity_and_disables_legacy_auto_login(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    User.__table__.create(engine)
    app = FastAPI()
    app.include_router(login_controller.router)

    def db_session():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[session] = db_session

    async def authenticate(username, password, challenge):
        if username == "rejected":
            raise IdentityRejected()
        assert (username, password, challenge) == ("alice", "secret", "challenge")
        return ModelSwitchIdentity(UUID("57d309d0-43fd-4d64-a764-625f7903c105"))

    monkeypatch.setattr(login_controller, "authenticate_modelswitch", authenticate)

    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            legacy = await client.post("/user/auto-login")
            assert legacy.status_code == 403
            for path in ("/user/login", "/user/dev_login", "/user/refresh"):
                assert (await client.post(path, json={})).status_code == 404
            rejected = await client.post(
                "/user/modelswitch-password-login", json={"username": "rejected", "password": "secret"}
            )
            assert rejected.status_code == 401
            response = await client.post(
                "/user/modelswitch-password-login",
                json={"username": "alice", "password": "secret", "turnstile_token": "challenge"},
            )
            assert response.status_code == 200
            assert response.json()["user_id"] == 1
            assert response.json()["token"]
            assert "secret" not in response.text

    try:
        asyncio.run(exercise())
    finally:
        engine.dispose()


def test_legacy_local_token_cannot_authenticate(monkeypatch):
    engine = create_engine("sqlite:///:memory:")
    User.__table__.create(engine)

    async def not_blacklisted(_jti):
        return False

    monkeypatch.setattr(user_auth, "is_blacklisted", not_blacklisted)
    with Session(engine) as db:
        legacy = User(email="legacy@example.com")
        db.add(legacy)
        db.commit()
        db.refresh(legacy)
        token = user_auth.create_access_token(legacy.id)
        with pytest.raises(TokenException):
            asyncio.run(user_auth.auth_must(token, db))
    engine.dispose()
