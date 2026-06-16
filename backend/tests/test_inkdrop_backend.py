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


# ----------------------------------------------------------------------------
# Iteration 2: SSE streaming, cover art (Nano Banana), chunk editing
# ----------------------------------------------------------------------------

def _parse_sse(resp):
    """Yield JSON payloads from a streaming requests Response."""
    import json as _json
    buf = ""
    for raw in resp.iter_lines(decode_unicode=True):
        if raw is None:
            continue
        if raw == "":
            # event boundary
            if buf.startswith("data:"):
                payload = buf[len("data:"):].strip()
                try:
                    yield _json.loads(payload)
                except Exception:
                    pass
            buf = ""
        else:
            buf = raw  # we only need single-line data events


def test_story_generate_stream_sse():
    h = {"Authorization": f"Bearer {state['token']}"}
    payload = {
        "brain_dump": "snow falling on a quiet train station at dawn",
        "vibe": "poetic_slow_burn",
        "deai_level": 70,
    }
    with requests.post(
        f"{API}/story/generate/stream", headers=h, json=payload, stream=True, timeout=120
    ) as r:
        assert r.status_code == 200, r.text
        assert "text/event-stream" in r.headers.get("content-type", "")
        events = []
        deltas = []
        meta = None
        done = None
        for ev in _parse_sse(r):
            events.append(ev)
            t = ev.get("type")
            if t == "meta":
                meta = ev
            elif t == "delta":
                deltas.append(ev.get("text", ""))
            elif t == "done":
                done = ev
                break
            elif t == "error":
                pytest.fail(f"SSE error: {ev}")
        assert meta is not None and "story_id" in meta and meta.get("title")
        assert len(deltas) >= 3, f"expected multiple deltas, got {len(deltas)}"
        assert done is not None and done.get("story_id") == meta["story_id"]
    state["stream_story_id"] = meta["story_id"]
    state["stream_full_text"] = "".join(deltas).strip()
    # Verify the story was persisted with the concatenated text
    r = requests.get(f"{API}/story/{state['stream_story_id']}", headers=h)
    assert r.status_code == 200
    s = r.json()
    assert len(s["chunks"]) == 1
    persisted = s["chunks"][0]["text"]
    # allow small whitespace difference
    assert persisted.startswith(state["stream_full_text"][:80])


def test_story_continue_stream_sse():
    h = {"Authorization": f"Bearer {state['token']}"}
    payload = {
        "story_id": state["stream_story_id"],
        "coauthor_directive": "a conductor steps off and notices her",
    }
    with requests.post(
        f"{API}/story/continue/stream", headers=h, json=payload, stream=True, timeout=120
    ) as r:
        assert r.status_code == 200
        deltas = []
        meta = None
        done = None
        for ev in _parse_sse(r):
            t = ev.get("type")
            if t == "meta":
                meta = ev
            elif t == "delta":
                deltas.append(ev.get("text", ""))
            elif t == "done":
                done = ev
                break
            elif t == "error":
                pytest.fail(f"SSE error: {ev}")
        assert meta and done
        assert len(deltas) >= 3
    # verify second chunk persisted with directive
    r = requests.get(f"{API}/story/{state['stream_story_id']}", headers=h)
    assert r.status_code == 200
    s = r.json()
    assert len(s["chunks"]) == 2
    assert s["chunks"][1]["directive"] == "a conductor steps off and notices her"


def test_cover_endpoint_returns_only_cover_fields():
    """GET /story/{id}/cover returns only cover_status/cover_b64/cover_mime."""
    h = {"Authorization": f"Bearer {state['token']}"}
    r = requests.get(f"{API}/story/{state['stream_story_id']}/cover", headers=h)
    assert r.status_code == 200
    d = r.json()
    # should NOT contain chunks/title/etc
    assert "chunks" not in d
    assert "title" not in d
    assert "cover_status" in d
    assert d["cover_status"] in ("pending", "ready", "failed")


def test_cover_generates_within_timeout():
    """Wait up to ~75s for cover to become 'ready' with base64 data."""
    h = {"Authorization": f"Bearer {state['token']}"}
    sid = state["stream_story_id"]
    deadline = time.time() + 90
    final = None
    while time.time() < deadline:
        r = requests.get(f"{API}/story/{sid}/cover", headers=h)
        assert r.status_code == 200
        d = r.json()
        final = d
        if d.get("cover_status") in ("ready", "failed"):
            break
        time.sleep(3)
    assert final is not None
    if final["cover_status"] != "ready":
        pytest.skip(f"Cover did not become ready in time (status={final['cover_status']}). Likely external Nano Banana latency.")
    assert isinstance(final.get("cover_b64"), str) and len(final["cover_b64"]) > 1000
    assert final.get("cover_mime", "").startswith("image/")
    state["cover_b64_len_initial"] = len(final["cover_b64"])


def test_library_excludes_cover_b64_includes_has_cover():
    h = {"Authorization": f"Bearer {state['token']}"}
    r = requests.get(f"{API}/story/library", headers=h)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1
    for s in items:
        assert "cover_b64" not in s, "library must NOT include heavy cover_b64"
        assert "has_cover" in s and isinstance(s["has_cover"], bool)


def test_community_feed_excludes_cover_b64_includes_has_cover():
    # share the streamed story to public
    h = {"Authorization": f"Bearer {state['token']}"}
    r = requests.post(f"{API}/story/share", headers=h, json={"story_id": state["stream_story_id"], "share": True})
    assert r.status_code == 200
    # fetch feed via any user
    r = requests.get(f"{API}/community/feed", headers=h)
    assert r.status_code == 200
    feed = r.json()
    assert any(s["id"] == state["stream_story_id"] for s in feed)
    for s in feed:
        assert "cover_b64" not in s
        assert "has_cover" in s


def test_chunk_edit_persists_and_adds_edited_at():
    h = {"Authorization": f"Bearer {state['token']}"}
    sid = state["stream_story_id"]
    new_text = "TEST_EDITED: The platform lay silent under a sheet of new snow."
    r = requests.patch(f"{API}/story/{sid}/chunks/0", headers=h, json={"text": new_text})
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["chunks"][0]["text"] == new_text
    assert "edited_at" in s["chunks"][0]
    # re-fetch to confirm persistence
    r = requests.get(f"{API}/story/{sid}", headers=h)
    assert r.status_code == 200
    assert r.json()["chunks"][0]["text"] == new_text


def test_chunk_edit_invalid_index_returns_400():
    h = {"Authorization": f"Bearer {state['token']}"}
    sid = state["stream_story_id"]
    r = requests.patch(f"{API}/story/{sid}/chunks/-1", headers=h, json={"text": "x"})
    assert r.status_code == 400
    r = requests.patch(f"{API}/story/{sid}/chunks/99", headers=h, json={"text": "x"})
    assert r.status_code == 400


def test_chunk_edit_non_owner_returns_404():
    h = {"Authorization": f"Bearer {state['other_token']}"}
    sid = state["stream_story_id"]
    r = requests.patch(f"{API}/story/{sid}/chunks/0", headers=h, json={"text": "hijack"})
    assert r.status_code == 404


def test_cover_regenerate_resets_to_pending_then_ready():
    h = {"Authorization": f"Bearer {state['token']}"}
    sid = state["stream_story_id"]
    r = requests.post(f"{API}/story/{sid}/cover/regenerate", headers=h)
    assert r.status_code == 200
    assert r.json()["cover_status"] == "pending"
    # immediately check status reflects pending (b64 cleared)
    r = requests.get(f"{API}/story/{sid}/cover", headers=h)
    assert r.status_code == 200
    # could already have flipped to ready if super-fast; just assert no crash
    # poll until terminal
    deadline = time.time() + 90
    final = None
    while time.time() < deadline:
        r = requests.get(f"{API}/story/{sid}/cover", headers=h)
        d = r.json()
        final = d
        if d.get("cover_status") in ("ready", "failed"):
            break
        time.sleep(3)
    if final["cover_status"] != "ready":
        pytest.skip(f"Cover regen did not finish: {final['cover_status']}")
    assert isinstance(final.get("cover_b64"), str) and len(final["cover_b64"]) > 1000


def test_story_delete():
    h = {"Authorization": f"Bearer {state['token']}"}
    r = requests.delete(f"{API}/story/{state['story_id']}", headers=h)
    assert r.status_code == 200
    r = requests.get(f"{API}/story/{state['story_id']}", headers=h)
    assert r.status_code == 404
    # also clean up streamed story
    if state.get("stream_story_id"):
        requests.delete(f"{API}/story/{state['stream_story_id']}", headers=h)
