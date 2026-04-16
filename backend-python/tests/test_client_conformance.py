"""
Thin-client conformance tests for the web and mobile clients.

These tests enforce that domain logic remains in the backend while
allowing presentation-only client logic such as labels, colors,
formatting, and UI aggregates.
"""
from __future__ import annotations

import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
CLIENT_ROOTS = [
    REPO_ROOT / "web" / "src",
    REPO_ROOT / "app",
    REPO_ROOT / "frontendServices",
]

WEB_ADD_EVENT = REPO_ROOT / "web" / "src" / "pages" / "AddEvent.tsx"
MOBILE_ADD_EVENT = REPO_ROOT / "app" / "(tabs)" / "car" / "[id]" / "add-event.tsx"
WEB_ADD_INCIDENT = REPO_ROOT / "web" / "src" / "pages" / "AddIncident.tsx"
MOBILE_API = REPO_ROOT / "frontendServices" / "apiCall.ts"
WEB_API = REPO_ROOT / "web" / "src" / "api" / "cars.ts"
WEB_CAR_DETAIL = REPO_ROOT / "web" / "src" / "pages" / "CarDetail.tsx"
MOBILE_CAR_DETAIL = REPO_ROOT / "app" / "(tabs)" / "car" / "[id]" / "index.tsx"
WEB_HOME = REPO_ROOT / "web" / "src" / "pages" / "Home.tsx"
MOBILE_HOME = REPO_ROOT / "app" / "(tabs)" / "index.tsx"


def _client_files() -> list[Path]:
    files: list[Path] = []
    for root in CLIENT_ROOTS:
        files.extend(sorted(root.rglob("*.ts")))
        files.extend(sorted(root.rglob("*.tsx")))
    return sorted(set(files))


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_clients_do_not_duplicate_score_grade_thresholds() -> None:
    """
    Clients may render backend-provided grades and color-code score bars,
    but they must not re-implement the backend's grade assignment rules
    (A/B/C/D/F thresholds).
    """
    forbidden_patterns = [
        re.compile(r"grade\s*=\s*score\s*>=\s*90"),
        re.compile(r"grade\s*=\s*overall_score\s*>=\s*90"),
        re.compile(r"if\s*\(\s*(?:overall_)?score\s*>=\s*90\s*\).*['\"]A['\"]", re.DOTALL),
        re.compile(r"if\s*\(\s*(?:overall_)?score\s*>=\s*75\s*\).*['\"]B['\"]", re.DOTALL),
        re.compile(r"if\s*\(\s*(?:overall_)?score\s*>=\s*60\s*\).*['\"]C['\"]", re.DOTALL),
        re.compile(r"if\s*\(\s*(?:overall_)?score\s*>=\s*40\s*\).*['\"]D['\"]", re.DOTALL),
    ]

    offenders: list[str] = []
    for path in _client_files():
        text = _read(path)
        for pattern in forbidden_patterns:
            if pattern.search(text):
                offenders.append(f"{path.relative_to(REPO_ROOT)} matches {pattern.pattern}")

    assert not offenders, (
        "Client files must not duplicate backend grade thresholds.\n"
        + "\n".join(offenders)
    )


def test_clients_do_not_duplicate_service_urgency_thresholds() -> None:
    """
    Clients may display already-computed urgency values and remaining
    days/km, but they must not encode the backend service-interval
    threshold rules locally.
    """
    forbidden_patterns = [
        re.compile(r"days_until_due\s*<=\s*30"),
        re.compile(r"0\s*<=\s*days_until_due\s*<=\s*30"),
        re.compile(r"km_until_due\s*<=\s*1000"),
        re.compile(r"0\s*<=\s*km_until_due\s*<=\s*1000"),
        re.compile(r"urgency\s*=\s*['\"]soon['\"]"),
        re.compile(r"urgency\s*=\s*['\"]overdue['\"]"),
        re.compile(r"if\s*\(\s*days_until_due\s*<\s*0\s*\)\s*\{[^}]*urgency", re.DOTALL),
        re.compile(r"if\s*\(\s*km_until_due\s*<\s*0\s*\)\s*\{[^}]*urgency", re.DOTALL),
    ]

    offenders: list[str] = []
    for path in _client_files():
        text = _read(path)
        for pattern in forbidden_patterns:
            if pattern.search(text):
                offenders.append(f"{path.relative_to(REPO_ROOT)} matches {pattern.pattern}")

    assert not offenders, (
        "Client files must not duplicate backend urgency thresholds.\n"
        + "\n".join(offenders)
    )


def test_clients_fetch_backend_owned_vocabularies_from_api_modules() -> None:
    """
    Event types and incident vocabularies must be fetched from backend
    API helpers. Client-side fallback arrays are allowed only as local
    resilience if the fetch fails.
    """
    web_add_event = _read(WEB_ADD_EVENT)
    mobile_add_event = _read(MOBILE_ADD_EVENT)
    web_add_incident = _read(WEB_ADD_INCIDENT)
    web_api = _read(WEB_API)
    mobile_api = _read(MOBILE_API)

    assert "getEventTypes" in web_api
    assert "getIncidentTypes" in web_api
    assert "getEventTypes" in mobile_api
    assert "getIncidentTypes" in mobile_api

    assert "carsApi.getEventTypes()" in web_add_event
    assert "api.getEventTypes()" in mobile_add_event
    assert "carsApi.getIncidentTypes()" in web_add_incident

    assert "SEVERITY_FALLBACK" in web_add_incident
    assert "REPAIR_STATUS_FALLBACK" in web_add_incident


def test_clients_consume_backend_score_and_service_status_dtos() -> None:
    """
    Thin clients should consume backend DTOs rather than synthesizing
    score or service-interval structures locally.
    """
    web_car_detail = _read(WEB_CAR_DETAIL)
    mobile_car_detail = _read(MOBILE_CAR_DETAIL)
    web_home = _read(WEB_HOME)
    mobile_home = _read(MOBILE_HOME)
    web_api = _read(WEB_API)
    mobile_api = _read(MOBILE_API)

    assert "CarCareScoreResponse" in web_api
    assert "CarServiceStatus" in web_api
    assert "AllCarsServiceStatus" in web_api
    assert "CarCareScoreResponse" in mobile_api
    assert "CarServiceStatus" in mobile_api
    assert "AllCarsServiceStatus" in mobile_api

    for text, label in [
        (web_car_detail, "web car detail"),
        (mobile_car_detail, "mobile car detail"),
        (web_home, "web home"),
        (mobile_home, "mobile home"),
    ]:
        assert "overall_score" in text, f"{label} should render backend score fields"
        assert "grade" in text, f"{label} should render backend grade fields"
        assert "confidence_label" in text, f"{label} should render backend confidence fields"

    assert "recommendations" in web_car_detail
    assert "recommendations" in mobile_car_detail
    assert "days_until_due" in web_car_detail
    assert "km_until_due" in web_car_detail
    assert "days_until_due" in mobile_car_detail
    assert "km_until_due" in mobile_car_detail
