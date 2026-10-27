"""Map verified ModelSwitch account IDs to distinct local workspace users."""

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.domains.user.modelswitch_identity import ModelSwitchIdentity
from app.model.user.user import Status, User


class LocalIdentityBlocked(Exception):
    """The existing local workspace user is blocked."""


def get_or_create_local_user(session: Session, identity: ModelSwitchIdentity) -> User:
    def find_user() -> User | None:
        return session.exec(select(User).where(User.stack_id == identity.local_key)).one_or_none()

    user = find_user()
    if user is None:
        user = User(
            stack_id=identity.local_key,
            email=identity.local_email,
            nickname="Modex",
        )
        session.add(user)
        try:
            session.commit()
            session.refresh(user)
        except IntegrityError:
            # A concurrent login may have created the same verified account.
            session.rollback()
            user = find_user()
            if user is None:
                raise

    if user.status != Status.Normal:
        raise LocalIdentityBlocked()
    return user
