def test_analyze_counts(client):
    r = client.post("/v1/analyze", json={"text": "hello world"})
    assert r.status_code == 200
    data = r.json()
    assert data["result"]["word_count"] == 2
    assert data["result"]["char_count"] == len("hello world")


def test_analyze_rejects_empty(client):
    r = client.post("/v1/analyze", json={"text": "   "})
    assert r.status_code == 400