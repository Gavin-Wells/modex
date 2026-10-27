from pathlib import Path

from app.memory.paths import memory_root
from app.permission_policy.tool_actions import _is_control_plane_sequence
from app.run_journal.paths import default_run_journal_path
from app.utils.workspace_paths import get_eigent_root, run_output_root


def test_local_state_is_separate_from_upstream(monkeypatch, tmp_path):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)

    assert default_run_journal_path() == tmp_path / ".modex" / "run-journal.sqlite3"
    assert memory_root() == tmp_path / ".modex" / "memory"
    assert get_eigent_root() == tmp_path / "modex"
    assert ".modex" in run_output_root("a@example.com", "s", "p", "r", 1).parts
    assert not (tmp_path / ".modex").exists()


def test_modex_control_plane_paths_are_protected():
    assert _is_control_plane_sequence(("sqlite3", "~/.modex/run-journal.sqlite3"))
    assert _is_control_plane_sequence(("printenv", "MODEX_WORKSPACE_CAPABILITY"))
    assert _is_control_plane_sequence(("cat", "/Users/a/Library/Application Support/Modex/workspace/workspace-secret"))
