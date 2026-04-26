"""
Architecture tests that verify layer boundaries without importing app modules.
"""
from __future__ import annotations

import ast
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
INTERNAL_ROOTS = {"routers", "services", "repositories", "domain", "schemas", "config"}


def _layer_files(layer: str) -> list[Path]:
    base = PROJECT_ROOT / layer
    return sorted(p for p in base.rglob("*.py") if p.name != "__init__.py")


def _top_level_imports(py_file: Path) -> set[str]:
    imports: set[str] = set()
    tree = ast.parse(py_file.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".", 1)[0]
                if root in INTERNAL_ROOTS:
                    imports.add(root)
        elif isinstance(node, ast.ImportFrom):
            if node.level > 0:
                continue
            if not node.module:
                continue
            root = node.module.split(".", 1)[0]
            if root in INTERNAL_ROOTS:
                imports.add(root)
    return imports


def _assert_no_imports(layer: str, forbidden_roots: set[str]) -> None:
    offenders: list[str] = []
    for py_file in _layer_files(layer):
        imported = _top_level_imports(py_file)
        overlap = sorted(imported & forbidden_roots)
        if overlap:
            rel = py_file.relative_to(PROJECT_ROOT)
            offenders.append(f"{rel} imports {', '.join(overlap)}")
    assert not offenders, "Layer violations:\n" + "\n".join(offenders)


def test_routers_do_not_import_repositories_or_domain() -> None:
    _assert_no_imports("routers", {"repositories", "domain"})


def test_services_do_not_import_routers() -> None:
    _assert_no_imports("services", {"routers"})


def test_repositories_do_not_import_upward_layers() -> None:
    _assert_no_imports("repositories", {"routers", "services", "domain", "schemas"})


def test_schemas_are_isolated_from_app_layers() -> None:
    _assert_no_imports("schemas", {"routers", "services", "repositories", "domain", "config"})


def test_scoring_engine_is_framework_free() -> None:
    scoring_engine = PROJECT_ROOT / "domain" / "scoring" / "engine.py"
    imported = _top_level_imports(scoring_engine)

    # Scoring engine should only depend on local scoring normalize types.
    assert "domain" in imported
    forbidden = {"routers", "repositories", "config", "services", "schemas"} & imported
    assert not forbidden, f"domain/scoring/engine.py imports forbidden modules: {', '.join(sorted(forbidden))}"
