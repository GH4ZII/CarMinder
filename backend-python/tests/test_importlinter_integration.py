"""
Optional integration test for import-linter.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
IMPORTLINTER_PATH = PROJECT_ROOT / ".importlinter"


@pytest.mark.skipif(shutil.which("lint-imports") is None, reason="lint-imports is not installed")
def test_importlinter_contracts_pass() -> None:
    completed = subprocess.run(
        ["lint-imports", "--config", str(IMPORTLINTER_PATH)],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed.returncode == 0, completed.stdout + "\n" + completed.stderr
