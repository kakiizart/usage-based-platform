from types import SimpleNamespace

import src.main as main


def _install_valid_key_and_active_subscription(monkeypatch):
    class FakeTable:
        def __init__(self, name):
            self.name = name

        def select(self, *_):
            return self

        def eq(self, *_):
            return self

        def limit(self, *_):
            return self

        def execute(self):
            if self.name == "api_keys":
                return SimpleNamespace(
                    data=[
                        {
                            "id": 1,
                            "user_id": "user_123",
                            "is_active": True,
                        }
                    ]
                )

            if self.name == "subscriptions":
                return SimpleNamespace(
                    data=[
                        {"status": "active"},
                    ]
                )

            return SimpleNamespace(data=[])

    class FakeSupabase:
        def table(self, name):
            return FakeTable(name)

    monkeypatch.setattr(main, "supabase", FakeSupabase())
    monkeypatch.setattr(main, "_hash_api_key", lambda raw_key: "fakehash123")


def test_analyze_counts(client, monkeypatch):
    _install_valid_key_and_active_subscription(monkeypatch)

    r = client.post(
        "/v1/analyze",
        headers={"Authorization": "Bearer ubp_test_key"},
        json={"text": "hello world"},
    )

    assert r.status_code == 200
    body = r.json()
    assert body["result"]["word_count"] == 2
    assert body["result"]["char_count"] == 11


def test_analyze_rejects_empty(client, monkeypatch):
    _install_valid_key_and_active_subscription(monkeypatch)

    r = client.post(
        "/v1/analyze",
        headers={"Authorization": "Bearer ubp_test_key"},
        json={"text": "   "},
    )

    assert r.status_code == 400
    assert r.json()["detail"] == "text is required"