"""InkDrop backend e2e API tests."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://brain-to-story.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
TS = int(time.time())
EMAIL = f"e2e-{TS}@example.com"
PASSWORD = "TestPass123!"
NAME = "E2E Tester"

state = {}

BANNED = ["testament", "beacon", "profound", "delve", "tapestry", "embarked", "myriad", "realm", "kaleidoscope"]


def test_health():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_daily_prompt_no_auth():
    r = requests.get(f"{API}/prompts/daily")
    assert r.status_code == 200
    d = r.json()
    assert isinstance(d.get("prompt"), str) and len(d["prompt"]) > 10
    assert "date" in d


def test_signup():
    r = requests.post(f"{API}/auth/signup", json={"email": EMAIL, "password": PASSWORD, "display_name": NAME})
    assert r.status_code == 200, r.text
    d = r.json()
    assert "token" in d and d["user"]["email"] == EMAIL
    state["token"] = d["token"]
    state["uid"] = d["user"]["id"]


def test_login_wrong_password():
    r = requests.post(f"{API}/auth/login", json={"email": EMAIL, "password": "wrong"})
    assert r.status_code == 401


def test_login_ok():
    r = requests.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200


def test_me_with_token():
    h = {"Authorization": f"Bearer {state['token']}"}
    r = requests.get(f"{API}/auth/me", headers=h)
    assert r.status_code == 200
    assert r.json()["email"] == EMAIL


def test_me_no_token():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_protected_endpoints_require_auth():
    for ep in ["/story/library", "/characters", "/community/feed"]:
        r = requests.get(f"{API}{ep}")
        assert r.status_code == 401, f"{ep} should require auth"


def test_story_generate():
    h = {"Authorization": f"Bearer {state['token']}"}
    payload = {
        "brain_dump": "rainy night, old diner, two strangers share silence over coffee",
        "vibe": "poetic_slow_burn",
        "deai_level": 80,
    }
    r = requests.post(f"{API}/story/generate", headers=h, json=payload, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["vibe"] == "poetic_slow_burn"
    assert isinstance(d["chunks"], list) and len(d["chunks"]) == 1
    text = d["chunks"][0]["text"]
    wc = len(text.split())
    assert 150 <= wc <= 500, f"word count {wc} outside reasonable range"
    lower = text.lower()
    found_banned = [b for b in BANNED if b in lower]
    state["banned_in_chunk1"] = found_banned
    state["story_id"] = d["id"]


def test_story_continue_with_directive():
    h = {"Authorization": f"Bearer {state['token']}"}
    payload = {"story_id": state["story_id"], "coauthor_directive": "introduce a stranger at the counter"}
    r = requests.post(f"{API}/story/continue", headers=h, json=payload, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    assert len(d["chunks"]) == 2
    assert d["chunks"][1]["directive"] == "introduce a stranger at the counter"


def test_library():
    h = {"Authorization": f"Bearer {state['token']}"}
    r = requests.get(f"{API}/story/library", headers=h)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1
    s = items[0]
    assert "preview" in s and "chunk_count" in s and "word_count" in s


def test_story_get_owner():
    h = {"Authorization": f"Bearer {state['token']}"}
    r = requests.get(f"{API}/story/{state['story_id']}", headers=h)
    assert r.status_code == 200


def test_story_get_other_user_private_404():
    # Create another user, try fetching first user's private story
    other_email = f"e2e-other-{TS}@example.com"
    r = requests.post(f"{API}/auth/signup", json={"email": other_email, "password": PASSWORD, "display_name": "Other"})
    assert r.status_code == 200
    other_token = r.json()["token"]
    h = {"Authorization": f"Bearer {other_token}"}
    r = requests.get(f"{API}/story/{state['story_id']}", headers=h)
    assert r.status_code == 404
    state["other_token"] = other_token


def test_share_and_community_feed():
    h = {"Authorization": f"Bearer {state['token']}"}
    r = requests.post(f"{API}/story/share", headers=h, json={"story_id": state["story_id"], "share": True})
    assert r.status_code == 200 and r.json()["is_public"] is True
    # Other user should now find it
    h2 = {"Authorization": f"Bearer {state['other_token']}"}
    r = requests.get(f"{API}/community/feed", headers=h2)
    assert r.status_code == 200
    feed = r.json()
    mine = [s for s in feed if s["id"] == state["story_id"]]
    assert len(mine) == 1
    assert mine[0].get("author") == NAME


def test_export_md():
    h = {"Authorization": f"Bearer {state['token']}"}
    r = requests.get(f"{API}/story/{state['story_id']}/export", params={"fmt": "md"}, headers=h)
    assert r.status_code == 200
    d = r.json()
    assert d["content"].startswith("# ")
    assert "---" in d["content"]


def test_characters_crud():
    h = {"Authorization": f"Bearer {state['token']}"}
    r = requests.post(f"{API}/characters", headers=h, json={"name": "TEST_Mira", "role": "rival", "description": "sharp-eyed"})
    assert r.status_code == 200
    cid = r.json()["id"]
    r = requests.get(f"{API}/characters", headers=h)
    assert any(c["id"] == cid for c in r.json())
    r = requests.delete(f"{API}/characters/{cid}", headers=h)
    assert r.status_code == 200


def test_voice_requires_auth():
    r = requests.post(f"{API}/voice/transcribe", files={"file": ("a.wav", b"RIFF", "audio/wav")})
    assert r.status_code == 401


def test_story_delete():
    h = {"Authorization": f"Bearer {state['token']}"}
    r = requests.delete(f"{API}/story/{state['story_id']}", headers=h)
    assert r.status_code == 200
    r = requests.get(f"{API}/story/{state['story_id']}", headers=h)
    assert r.status_code == 404
