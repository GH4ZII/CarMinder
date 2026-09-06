"""Tests for cron-protected notification deadline checks."""
import asyncio

import pytest

from services import push_token_service


def test_check_deadlines_rejects_when_cron_secret_not_configured(monkeypatch):
    monkeypatch.setattr(
        "services.push_token_service.get_settings",
        lambda: {"CRON_SECRET": ""},
    )

    with pytest.raises(PermissionError, match="Cron secret not configured"):
        asyncio.run(push_token_service.check_deadlines("any-secret"))


def test_check_deadlines_rejects_invalid_secret(monkeypatch):
    monkeypatch.setattr(
        "services.push_token_service.get_settings",
        lambda: {"CRON_SECRET": "expected"},
    )

    with pytest.raises(PermissionError, match="Invalid cron secret"):
        asyncio.run(push_token_service.check_deadlines("wrong-secret"))
