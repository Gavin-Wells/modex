from pathlib import Path

from app.memory.paths import memory_root
from app.run_journal.paths import default_run_journal_path


def test_local_state_is_separate_from_upstream(monkeypatch, tmp_path):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)

    assert default_run_journal_path() == tmp_path / ".modex" / "run-journal.sqlite3"
    assert memory_root() == tmp_path / ".modex" / "memory"
    assert not (tmp_path / ".modex").exists()
