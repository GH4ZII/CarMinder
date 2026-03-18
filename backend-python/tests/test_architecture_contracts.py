"""
Contract and wiring tests for architecture guardrails.
"""
from __future__ import annotations

import ast
import configparser
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
IMPORTLINTER_PATH = PROJECT_ROOT / ".importlinter"
MAIN_PATH = PROJECT_ROOT / "main.py"
ROUTERS_DIR = PROJECT_ROOT / "routers"


def test_importlinter_contains_required_contracts() -> None:
    parser = configparser.ConfigParser()
    parser.read(IMPORTLINTER_PATH)

    expected_sections = {
        "importlinter:contract:layers",
        "importlinter:contract:domain-isolation",
        "importlinter:contract:routers-no-domain",
        "importlinter:contract:routers-no-repositories",
        "importlinter:contract:repositories-no-upward-deps",
        "importlinter:contract:services-no-routers",
        "importlinter:contract:schemas-isolation",
    }

    missing = sorted(section for section in expected_sections if section not in parser)
    assert not missing, f"Missing import-linter contracts: {', '.join(missing)}"


def test_main_imports_all_router_modules() -> None:
    tree = ast.parse(MAIN_PATH.read_text(encoding="utf-8"))

    imported_router_modules: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module == "routers":
            imported_router_modules.update(alias.name for alias in node.names)

    expected = {
        p.stem
        for p in ROUTERS_DIR.glob("*.py")
        if p.name != "__init__.py"
    }
    missing = sorted(expected - imported_router_modules)
    assert not missing, f"Router modules not imported in main.py: {', '.join(missing)}"


def test_main_includes_each_router_module() -> None:
    tree = ast.parse(MAIN_PATH.read_text(encoding="utf-8"))

    included_modules: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        if not isinstance(node.func, ast.Attribute):
            continue
        if node.func.attr != "include_router":
            continue
        if not node.args:
            continue
        arg = node.args[0]
        if isinstance(arg, ast.Attribute) and isinstance(arg.value, ast.Name):
            included_modules.add(arg.value.id)

    expected = {
        p.stem
        for p in ROUTERS_DIR.glob("*.py")
        if p.name != "__init__.py"
    }
    missing = sorted(expected - included_modules)
    assert not missing, f"Router modules not included via app.include_router: {', '.join(missing)}"

