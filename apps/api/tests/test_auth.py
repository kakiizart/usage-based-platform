def test_me_requires_auth(client):
    r = client.get("/v1/me")  # no Authorization header
    assert r.status_code == 401