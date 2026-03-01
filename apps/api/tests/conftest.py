# apps/api/tests/conftest.py
import os
import pytest
from fastapi.testclient import TestClient

from src.main import app

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture(autouse=True)
def _set_test_env(monkeypatch):
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test_123")
    monkeypatch.setenv("STRIPE_PRICE_ID", "price_test_123")
    monkeypatch.setenv("WEB_BASE_URL", "http://localhost:3000")
    monkeypatch.setenv("APP_ENV", "test")