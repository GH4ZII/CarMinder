from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from config.auth import get_current_user_uid
from main import app


@pytest.fixture
def client() -> TestClient:
    app.dependency_overrides.clear()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def authenticated_client() -> TestClient:
    app.dependency_overrides[get_current_user_uid] = lambda: "test-user-123"
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
