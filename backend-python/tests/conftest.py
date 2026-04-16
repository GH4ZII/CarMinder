from __future__ import annotations

import sys
import types

import pytest
from fastapi.testclient import TestClient

from config.auth import get_current_user_uid

TEST_UID = "test-user-123"


def _install_pdf_stubs() -> None:
    if "supabase" not in sys.modules:
        supabase = types.ModuleType("supabase")

        class Client:  # pragma: no cover - import shim only
            pass

        def create_client(*args, **kwargs):
            return object()

        supabase.Client = Client
        supabase.create_client = create_client
        sys.modules["supabase"] = supabase

    if "reportlab" not in sys.modules:
        reportlab = types.ModuleType("reportlab")
        lib = types.ModuleType("reportlab.lib")
        pagesizes = types.ModuleType("reportlab.lib.pagesizes")
        pagesizes.A4 = (595.27, 841.89)
        pdfgen = types.ModuleType("reportlab.pdfgen")
        canvas = types.ModuleType("reportlab.pdfgen.canvas")
        canvas.Canvas = object

        sys.modules["reportlab"] = reportlab
        sys.modules["reportlab.lib"] = lib
        sys.modules["reportlab.lib.pagesizes"] = pagesizes
        sys.modules["reportlab.pdfgen"] = pdfgen
        sys.modules["reportlab.pdfgen.canvas"] = canvas

    if "xhtml2pdf" not in sys.modules:
        xhtml2pdf = types.ModuleType("xhtml2pdf")
        pisa = types.ModuleType("xhtml2pdf.pisa")

        def create_pdf(*args, **kwargs):
            return types.SimpleNamespace(err=False)

        pisa.CreatePDF = create_pdf
        xhtml2pdf.pisa = pisa

        sys.modules["xhtml2pdf"] = xhtml2pdf
        sys.modules["xhtml2pdf.pisa"] = pisa


@pytest.fixture
def app():
    _install_pdf_stubs()
    from main import app as fastapi_app

    return fastapi_app


@pytest.fixture
def client(app) -> TestClient:
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def authenticated_client(app, client: TestClient) -> TestClient:
    app.dependency_overrides[get_current_user_uid] = lambda: TEST_UID
    return client
