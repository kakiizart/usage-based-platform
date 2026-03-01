import json
import stripe


def test_webhook_rejects_bad_signature(client, monkeypatch):
    payload = {"id": "evt_test", "type": "checkout.session.completed", "data": {"object": {}}}
    raw = json.dumps(payload).encode("utf-8")

    r = client.post(
        "/v1/stripe/webhook",
        content=raw,  # <-- changed from data=
        headers={"Stripe-Signature": "bad_sig"},
    )
    assert r.status_code == 400


def test_webhook_accepts_valid_signature(client, monkeypatch):
    # Make Stripe "construct_event" accept our payload (avoid crypto/signing complexity in unit tests)
    def fake_construct_event(payload, sig_header, secret):
        return {
            "id": "evt_test",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "metadata": {"user_id": "user_123"},
                    "customer": "cus_123",
                    "subscription": "sub_123",
                }
            },
        }

    monkeypatch.setattr(stripe.Webhook, "construct_event", fake_construct_event)

    # Avoid calling Stripe API to retrieve subscription
    def fake_sub_retrieve(sub_id, expand=None):
        return {
            "id": "sub_123",
            "status": "active",
            "current_period_start": 1700000000,
            "current_period_end": 1700003600,
            "items": {"data": [{"price": {"id": "price_test_123"}}]},
            "metadata": {"user_id": "user_123"},
            "customer": "cus_123",
        }

    monkeypatch.setattr(stripe.Subscription, "retrieve", fake_sub_retrieve)

    # Avoid real Supabase calls by stubbing the supabase client used in src.main
    class FakeTable:
        def __init__(self, name):
            self.name = name
        def select(self, *_): return self
        def eq(self, *_): return self
        def limit(self, *_): return self
        def execute(self):
            # app_users lookup fallback could happen; return empty to force metadata path
            class R: data = []
            return R()
        def upsert(self, payload, on_conflict=None):
            self._payload = payload
            return self

    class FakeSupabase:
        def table(self, name):
            return FakeTable(name)

    import src.main as main_module
    monkeypatch.setattr(main_module, "supabase", FakeSupabase())

    r = client.post(
        "/v1/stripe/webhook",
        content=b"{}",  # <-- changed from data=
        headers={"Stripe-Signature": "t=1,v1=ok"},
    )
    assert r.status_code == 200
    assert r.json()["received"] is True