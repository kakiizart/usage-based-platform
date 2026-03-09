from types import SimpleNamespace

import src.main as main


def test_analyze_allows_when_user_has_active_subscription(client, monkeypatch):
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

    r = client.post(
        "/v1/analyze",
        headers={"Authorization": "Bearer ubp_test_key"},
        json={"text": "hello from active user"},
    )

    assert r.status_code == 200
    body = r.json()
    assert body["result"]["word_count"] == 4


def test_analyze_blocks_when_user_has_no_subscription(client, monkeypatch):
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
                            "id": 2,
                            "user_id": "user_none",
                            "is_active": True,
                        }
                    ]
                )

            if self.name == "subscriptions":
                return SimpleNamespace(data=[])

            return SimpleNamespace(data=[])

    class FakeSupabase:
        def table(self, name):
            return FakeTable(name)

    monkeypatch.setattr(main, "supabase", FakeSupabase())
    monkeypatch.setattr(main, "_hash_api_key", lambda raw_key: "fakehash123")

    r = client.post(
        "/v1/analyze",
        headers={"Authorization": "Bearer ubp_test_key"},
        json={"text": "hello from unsubscribed user"},
    )

    assert r.status_code == 402
    assert r.json()["detail"] == "Active subscription required"


def test_analyze_blocks_when_user_only_has_inactive_subscription(client, monkeypatch):
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
                            "id": 3,
                            "user_id": "user_inactive",
                            "is_active": True,
                        }
                    ]
                )

            if self.name == "subscriptions":
                return SimpleNamespace(
                    data=[
                        {"status": "canceled"},
                        {"status": "incomplete"},
                    ]
                )

            return SimpleNamespace(data=[])

    class FakeSupabase:
        def table(self, name):
            return FakeTable(name)

    monkeypatch.setattr(main, "supabase", FakeSupabase())
    monkeypatch.setattr(main, "_hash_api_key", lambda raw_key: "fakehash123")

    r = client.post(
        "/v1/analyze",
        headers={"Authorization": "Bearer ubp_test_key"},
        json={"text": "hello from inactive user"},
    )

    assert r.status_code == 402
    assert r.json()["detail"] == "Active subscription required"


def test_analyze_allows_when_any_subscription_is_active(client, monkeypatch):
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
                            "id": 4,
                            "user_id": "user_mixed",
                            "is_active": True,
                        }
                    ]
                )

            if self.name == "subscriptions":
                return SimpleNamespace(
                    data=[
                        {"status": "canceled"},
                        {"status": "past_due"},
                        {"status": "active"},
                    ]
                )

            return SimpleNamespace(data=[])

    class FakeSupabase:
        def table(self, name):
            return FakeTable(name)

    monkeypatch.setattr(main, "supabase", FakeSupabase())
    monkeypatch.setattr(main, "_hash_api_key", lambda raw_key: "fakehash123")

    r = client.post(
        "/v1/analyze",
        headers={"Authorization": "Bearer ubp_test_key"},
        json={"text": "hello from mixed subscription user"},
    )

    assert r.status_code == 200
    body = r.json()
    assert body["result"]["char_count"] > 0