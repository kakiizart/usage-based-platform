from types import SimpleNamespace

import src.main as main


class FakeRedis:
    def __init__(self, initial=None):
        self.store = initial or {}

    def get(self, key):
        return self.store.get(key)

    def incr(self, key):
        current = int(self.store.get(key, 0))
        current += 1
        self.store[key] = str(current)
        return current


def _install_supabase(monkeypatch, subscription_rows):
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
                            "user_id": "user_active",
                            "is_active": True,
                        }
                    ]
                )

            if self.name == "subscriptions":
                return SimpleNamespace(data=subscription_rows)

            return SimpleNamespace(data=[])

    class FakeSupabase:
        def table(self, name):
            return FakeTable(name)

    monkeypatch.setattr(main, "supabase", FakeSupabase())
    monkeypatch.setattr(main, "_hash_api_key", lambda raw_key: "fakehash123")


def test_usage_returns_usage_for_active_user(client, monkeypatch):
    _install_supabase(monkeypatch, [{"status": "active"}])
    monkeypatch.setattr(
        main,
        "redis_client",
        FakeRedis({"usage:user:user_active:month:2026-03:requests_total": "7"}),
    )
    monkeypatch.setattr(main, "MONTHLY_REQUEST_QUOTA", 100)
    monkeypatch.setattr(main, "get_usage_bucket", lambda: "2026-03")

    r = client.get(
        "/v1/usage",
        headers={"Authorization": "Bearer ubp_test_key"},
    )

    assert r.status_code == 200
    body = r.json()
    assert body["month"] == "2026-03"
    assert body["used"] == 7
    assert body["quota"] == 100
    assert body["remaining"] == 93
    assert body["has_active_subscription"] is True


def test_usage_returns_inactive_subscription_state(client, monkeypatch):
    _install_supabase(monkeypatch, [{"status": "canceled"}])
    monkeypatch.setattr(
        main,
        "redis_client",
        FakeRedis({"usage:user:user_active:month:2026-03:requests_total": "2"}),
    )
    monkeypatch.setattr(main, "MONTHLY_REQUEST_QUOTA", 100)
    monkeypatch.setattr(main, "get_usage_bucket", lambda: "2026-03")

    r = client.get(
        "/v1/usage",
        headers={"Authorization": "Bearer ubp_test_key"},
    )

    assert r.status_code == 200
    body = r.json()
    assert body["used"] == 2
    assert body["remaining"] == 98
    assert body["has_active_subscription"] is False


def test_usage_requires_api_key(client):
    r = client.get("/v1/usage")
    assert r.status_code == 401
    assert r.json()["detail"] == "Missing Authorization header"