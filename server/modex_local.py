"""Start the desktop workspace service with local-only state and dependencies."""

import os
import secrets
import sqlite3
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse


def load_or_create_secret(state_dir: Path) -> str:
    state_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    path = state_dir / "workspace-secret"
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    try:
        descriptor = os.open(path, flags, 0o600)
    except FileExistsError:
        pass
    else:
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            output.write(secrets.token_urlsafe(48))
    secret = path.read_text(encoding="utf-8").strip()
    if len(secret) < 32:
        raise RuntimeError("Invalid local workspace secret")
    return secret


def configure_local_environment(state_dir: Path, redis_url: str, capability: str) -> dict[str, str]:
    parsed = urlparse(redis_url)
    if parsed.scheme != "redis" or parsed.hostname != "127.0.0.1" or not parsed.port:
        raise ValueError("Redis must use a managed loopback endpoint")
    if len(capability) < 32:
        raise ValueError("Workspace capability is too short")
    database_path = state_dir.resolve() / "workspace.sqlite3"
    if "?" in str(database_path) or "#" in str(database_path):
        raise ValueError("Workspace data path contains unsupported URL characters")
    secret = load_or_create_secret(state_dir)
    return {
        "database_url": f"sqlite:///{database_path}",
        "redis_url": redis_url,
        "SESSION_REDIS_URL": redis_url,
        "celery_broker_url": redis_url,
        "celery_result_url": redis_url,
        "secret_key": secret,
        "CHAT_SHARE_SECRET_KEY": secret,
        "CHAT_SHARE_SALT": "modex-local-share",
        "TOKEN_ISSUER": "modex-local-workspace",
        "TOKEN_AUDIENCE": "modex-local-api",
        "url_prefix": "/api",
        "CORS_ALLOW_ORIGINS": "null",
        "MODEX_WORKSPACE_CAPABILITY": capability,
    }


def backup_database(database_path: Path) -> Path | None:
    if not database_path.exists():
        return None
    backup_dir = database_path.parent / "backups"
    backup_dir.mkdir(mode=0o700, exist_ok=True)
    backup_path = backup_dir / f"workspace-{secrets.token_hex(12)}.sqlite3"
    descriptor = os.open(backup_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    os.close(descriptor)
    try:
        with sqlite3.connect(database_path) as source, sqlite3.connect(backup_path) as destination:
            source.backup(destination)
    except BaseException:
        backup_path.unlink(missing_ok=True)
        raise
    return backup_path


def needs_migration(database_path: Path) -> bool:
    if not database_path.exists():
        return False
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    root = Path(__file__).parent
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    heads = set(ScriptDirectory.from_config(config).get_heads())
    try:
        with sqlite3.connect(f"{database_path.resolve().as_uri()}?mode=ro", uri=True) as database:
            current = {row[0] for row in database.execute("SELECT version_num FROM alembic_version")}
    except sqlite3.DatabaseError:
        return True
    return current != heads


def main() -> None:
    if os.name != "nt":
        os.umask(0o077)
    state_dir = Path(os.environ["MODEX_WORKSPACE_DATA_DIR"])
    if not state_dir.is_absolute():
        raise ValueError("Workspace data path must be absolute")
    redis_url = os.environ["MODEX_WORKSPACE_REDIS_URL"]
    capability = os.environ["MODEX_WORKSPACE_CAPABILITY"]
    port = int(os.environ["MODEX_WORKSPACE_PORT"])
    if not 1024 <= port <= 65535:
        raise ValueError("Invalid workspace service port")
    env = configure_local_environment(state_dir, redis_url, capability)
    os.environ.update(env)
    # Preserve user data before a migration; no automatic restore or deletion.
    database_path = state_dir / "workspace.sqlite3"
    if needs_migration(database_path):
        backup_database(database_path)
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True, cwd=Path(__file__).parent)
    import uvicorn

    uvicorn.run("main:api", host="127.0.0.1", port=port, workers=1, log_level="info")


if __name__ == "__main__":
    main()
