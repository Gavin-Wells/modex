import os
import sqlite3

import pytest

from modex_local import backup_database, configure_local_environment, load_or_create_secret, needs_migration


def test_local_secret_is_stable_and_private(tmp_path):
    secret = load_or_create_secret(tmp_path / "state")
    assert len(secret) >= 32
    assert load_or_create_secret(tmp_path / "state") == secret
    if os.name != "nt":
        assert (tmp_path / "state" / "workspace-secret").stat().st_mode & 0o077 == 0


def test_only_managed_loopback_redis_is_accepted(tmp_path):
    config = configure_local_environment(tmp_path, "redis://127.0.0.1:43123/0", "a" * 48)
    assert config["database_url"].startswith("sqlite:///")
    assert config["CORS_ALLOW_ORIGINS"] == "null"
    with pytest.raises(ValueError):
        configure_local_environment(tmp_path, "redis://example.com:6379/0", "a" * 48)


def test_backup_preserves_existing_database(tmp_path):
    path = tmp_path / "workspace.sqlite3"
    with sqlite3.connect(path) as connection:
        connection.execute("CREATE TABLE test (value TEXT)")
        connection.execute("INSERT INTO test VALUES ('keep')")
    copy = backup_database(path)
    assert copy is not None
    with sqlite3.connect(copy) as connection:
        assert connection.execute("SELECT value FROM test").fetchone() == ("keep",)
    assert needs_migration(path)


def test_missing_database_needs_no_backup(tmp_path):
    assert not needs_migration(tmp_path / "missing.sqlite3")
