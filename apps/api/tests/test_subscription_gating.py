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


def _install_supabase_for_subscription_status(monkeypatch, subscription_rows):
    class FakeTable:
        def __init__(self, name):
            self.name = name
            self._filters = {}

        def select(self, *_):
            return self

        def eq(self, column, value):
            self._filters[column] = value
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


def test_analyze_allows_when_user_has_active_subscription(client, monkeypatch):
    _install_supabase_for_subscription_status(
        monkeypatch,
        [{"status": "active"}],
    )
    monkeypatch.setattr(main, "redis_client", FakeRedis())
    monkeypatch.setattr(main, "MONTHLY_REQUEST_QUOTA", 100)

    r = client.post(
        "/v1/analyze",
        headers={"Authorization": "Bearer ubp_test_key"},
        json={"text": "hello from active user"},
    )

    assert r.status_code == 200
    body = r.json()
    assert body["result"]["word_count"] == 4


def test_analyze_blocks_when_user_has_no_subscription(client, monkeypatch):
    _install_supabase_for_subscription_status(monkeypatch, [])
    monkeypatch.setattr(main, "redis_client", FakeRedis())
    monkeypatch.setattr(main, "MONTHLY_REQUEST_QUOTA", 100)

    r = client.post(
        "/v1/analyze",
        headers={"Authorization": "Bearer ubp_test_key"},
        json={"text": "hello from unsubscribed user"},
    )

    assert r.status_code == 402
    assert r.json()["detail"] == "Active subscription required"


def test_analyze_blocks_when_user_only_has_inactive_subscription(client, monkeypatch):
    _install_supabase_for_subscription_status(
        monkeypatch,
        [{"status": "canceled"}, {"status": "incomplete"}],
    )
    monkeypatch.setattr(main, "redis_client", FakeRedis())
    monkeypatch.setattr(main, "MONTHLY_REQUEST_QUOTA", 100)

    r = client.post(
        "/v1/analyze",
        headers={"Authorization": "Bearer ubp_test_key"},
        json={"text": "hello from inactive user"},
    )

    assert r.status_code == 402
    assert r.json()["detail"] == "Active subscription required"


def test_analyze_allows_when_any_subscription_is_active(client, monkeypatch):
    _install_supabase_for_subscription_status(
        monkeypatch,
        [{"status": "canceled"}, {"status": "past_due"}, {"status": "active"}],
    )
    monkeypatch.setattr(main, "redis_client", FakeRedis())
    monkeypatch.setattr(main, "MONTHLY_REQUEST_QUOTA", 100)

    r = client.post(
        "/v1/analyze",
        headers={"Authorization": "Bearer ubp_test_key"},
        json={"text": "hello from mixed subscription user"},
    )

    assert r.status_code == 200
    body = r.json()
    assert body["result"]["char_count"] > 0


def test_analyze_allows_when_under_quota(client, monkeypatch):
    _install_supabase_for_subscription_status(
        monkeypatch,
        [{"status": "active"}],
    )
    monkeypatch.setattr(
        main,
        "redis_client",
        FakeRedis({"usage:user:user_active:month:2026-03:requests_total": "2"}),
    )
    monkeypatch.setattr(main, "MONTHLY_REQUEST_QUOTA", 3)
    monkeypatch.setattr(main, "get_usage_bucket", lambda: "2026-03")

    r = client.post(
        "/v1/analyze",
        headers={"Authorization": "Bearer ubp_test_key"},
        json={"text": "quota still available"},
    )

    assert r.status_code == 200
    body = r.json()
    assert body["usage"]["month"] == "2026-03"
    assert body["usage"]["used"] == 3
    assert body["usage"]["quota"] == 3


def test_analyze_blocks_when_exactly_at_quota(client, monkeypatch):
    _install_supabase_for_subscription_status(
        monkeypatch,
        [{"status": "active"}],
    )
    monkeypatch.setattr(
        main,
        "redis_client",
        FakeRedis({"usage:user:user_active:month:2026-03:requests_total": "3"}),
    )
    monkeypatch.setattr(main, "MONTHLY_REQUEST_QUOTA", 3)
    monkeypatch.setattr(main, "get_usage_bucket", lambda: "2026-03")

    r = client.post(
        "/v1/analyze",
        headers={"Authorization": "Bearer ubp_test_key"},
        json={"text": "this should be blocked"},
    )

    assert r.status_code == 429
    assert r.json()["detail"] == "Monthly usage quota exceeded"


def test_analyze_blocks_when_over_quota(client, monkeypatch):
    _install_supabase_for_subscription_status(
        monkeypatch,
        [{"status": "active"}],
    )
    monkeypatch.setattr(
        main,
        "redis_client",
        FakeRedis({"usage:user:user_active:month:2026-03:requests_total": "99"}),
    )
    monkeypatch.setattr(main, "MONTHLY_REQUEST_QUOTA", 50)
    monkeypatch.setattr(main, "get_usage_bucket", lambda: "2026-03")

    r = client.post(
        "/v1/analyze",
        headers={"Authorization": "Bearer ubp_test_key"},
        json={"text": "way over quota"},
    )

    assert r.status_code == 429
    assert r.json()["detail"] == "Monthly usage quota exceeded"