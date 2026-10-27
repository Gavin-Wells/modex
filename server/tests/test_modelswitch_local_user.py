from uuid import UUID

import pytest
from sqlalchemy import create_engine
from sqlmodel import Session

from app.domains.user.modelswitch_identity import ModelSwitchIdentity
from app.domains.user.modelswitch_local_user import LocalIdentityBlocked, get_or_create_local_user
from app.model.user.user import Status, User


@pytest.fixture
def session():
    engine = create_engine("sqlite:///:memory:")
    User.__table__.create(engine)
    with Session(engine) as db:
        yield db
    engine.dispose()


def test_verified_accounts_get_separate_stable_local_users(session):
    first = ModelSwitchIdentity(UUID("57d309d0-43fd-4d64-a764-625f7903c105"))
    second = ModelSwitchIdentity(UUID("e10aab04-9bb6-4890-bcc5-06f4ea1a2cc3"))
    first_user = get_or_create_local_user(session, first)
    second_user = get_or_create_local_user(session, second)

    assert first_user.id != second_user.id
    assert get_or_create_local_user(session, first).id == first_user.id
    assert first_user.stack_id == first.local_key
    assert first_user.email == first.local_email


def test_blocked_local_user_is_not_reactivated(session):
    identity = ModelSwitchIdentity(UUID("57d309d0-43fd-4d64-a764-625f7903c105"))
    user = get_or_create_local_user(session, identity)
    user.status = Status.Block
    session.add(user)
    session.commit()

    with pytest.raises(LocalIdentityBlocked):
        get_or_create_local_user(session, identity)
