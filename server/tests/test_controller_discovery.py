import sys

import pytest
from fastapi import FastAPI

from app.core import environment


def test_controller_discovery_imports_package_modules(tmp_path, monkeypatch):
    package = tmp_path / "sample_controllers"
    package.mkdir()
    (package / "__init__.py").write_text("")
    (package / "sample_controller.py").write_text(
        "from fastapi import APIRouter\n"
        "from pydantic import BaseModel\n"
        "class Result(BaseModel):\n    value: str\n"
        "router = APIRouter()\n"
        "@router.get('/sample', response_model=Result)\n"
        "def get_sample(): return {'value': 'ok'}\n"
    )
    monkeypatch.syspath_prepend(str(tmp_path))
    monkeypatch.setattr(environment, "base_path", lambda: tmp_path)
    api = FastAPI()
    environment.auto_include_routers(api, "", str(package))
    assert "sample_controllers.sample_controller" in sys.modules
    assert "/sample" in api.openapi()["paths"]


def test_controller_failure_stops_startup(tmp_path, monkeypatch):
    package = tmp_path / "broken_controllers"
    package.mkdir()
    (package / "__init__.py").write_text("")
    (package / "broken_controller.py").write_text("raise ImportError('missing dependency')\n")
    monkeypatch.syspath_prepend(str(tmp_path))
    monkeypatch.setattr(environment, "base_path", lambda: tmp_path)
    with pytest.raises(RuntimeError, match="broken_controllers.broken_controller"):
        environment.auto_include_routers(FastAPI(), "", str(package))
