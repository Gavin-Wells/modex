"""Regression coverage for the local Modex workspace database."""

import json
import os
import sqlite3
import subprocess
import sys


def test_sqlite_upgrade_preserves_legacy_history_and_constraints(tmp_path, server_root):
    database = tmp_path / "workspace.sqlite"
    env = {**os.environ, "database_url": f"sqlite:///{database}"}

    def upgrade(revision):
        subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", revision],
            cwd=server_root,
            env=env,
            check=True,
            capture_output=True,
            text=True,
        )

    upgrade("add_remote_sub_agent_provider")
    with sqlite3.connect(database) as connection:
        connection.executemany(
            """INSERT INTO chat_history
            (user_id, task_id, question, language, model_platform, model_type,
             api_key, max_retries, installed_mcp, project_id)
            VALUES (?, ?, 'test', 'en', 'openai', 'test', '', 1, '[]', 'shared-project')""",
            [(1, "task-one"), (2, "task-two")],
        )
    upgrade("head")
    with sqlite3.connect(database) as connection:
        projects = connection.execute("SELECT id, metadata FROM project ORDER BY id").fetchall()
        assert [project[0] for project in projects] == ["1:shared-project", "2:shared-project"]
        assert all(json.loads(metadata)["legacy"] is True for _, metadata in projects)
        assert connection.execute("SELECT project_id FROM chat_history ORDER BY user_id").fetchall() == [
            ("1:shared-project",), ("2:shared-project",)
        ]
        partial_index = connection.execute(
            "SELECT sql FROM sqlite_master WHERE type='index' AND name='ix_remote_command_notification_pending'"
        ).fetchone()[0]
        assert "WHERE status = 'pending'" in partial_index
