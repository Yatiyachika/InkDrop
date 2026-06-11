"""
InkDrop — FastAPI backend.
Brain Dump → immersive literary fiction via Claude Sonnet 4.5.
"""

import os
import io
import uuid
import logging
import asyncio
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, List, Optional

import jwt
import bcrypt
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, BeforeValidator
from bson import ObjectId

from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAISpeechToText

# ----------------------------------------------------------------------------
# Env + DB
# ----------------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRY_HOURS = int(os.environ.get("JWT_EXPIRY_HOURS", "720"))

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("inkdrop")

# ----------------------------------------------------------------------------
# App + router
# ----------------------------------------------------------------------------
app = FastAPI(title="InkDrop API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

# ----------------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------------
PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    display_name: str = Field(min_length=1, max_length=80)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    display_name: str
    created_at: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class StoryGenerateRequest(BaseModel):
    brain_dump: str = Field(min_length=4)
    vibe: str  # "dark_gritty" | "poetic_slow_burn" | "thriller" | "cozy_nostalgic"
    deai_level: int = Field(default=70, ge=0, le=100)
    title: Optional[str] = None
    characters: Optional[List[dict]] = None  # [{name, description}]
    lore: Optional[str] = None


class StoryContinueRequest(BaseModel):
    story_id: str
    coauthor_directive: Optional[str] = None


class StoryShareRequest(BaseModel):
    story_id: str
    share: bool


class CharacterIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    role: Optional[str] = None
    description: str = Field(min_length=1)


# ----------------------------------------------------------------------------
# Auth helpers
# ----------------------------------------------------------------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    if creds is None:
        raise HTTPException(401, "Missing authorization")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        uid = payload["sub"]
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": uid})
    if not user:
        raise HTTPException(401, "User not found")
    return user


def user_to_out(u: dict) -> UserOut:
    return UserOut(
        id=u["id"],
        email=u["email"],
        display_name=u["display_name"],
        created_at=u["created_at"],
    )


# ----------------------------------------------------------------------------
# Storywriter system prompt builder
# ----------------------------------------------------------------------------
VIBE_DESCRIPTORS = {
    "dark_gritty": (
        "Tone: noir, raw, unflinching. Short, percussive sentences. "
        "Lean into shadows, sweat, the metallic tang of fear. "
        "Dialogue is clipped, profane only when honest."
    ),
    "poetic_slow_burn": (
        "Tone: lyrical, meditative, deliberate. Long flowing sentences with "
        "internal rhythm. Sensory imagery: light through curtains, the hush "
        "between heartbeats. Dialogue is sparse and weighted."
    ),
    "thriller": (
        "Tone: propulsive, sharp, cinematic. Sentences accelerate as tension "
        "tightens. Cut between sensation and action. Dialogue is fast and bare."
    ),
    "cozy_nostalgic": (
        "Tone: warm, gently melancholic, memory-soaked. Soft sensory anchors: "
        "wool, woodsmoke, the smell of old paperbacks. Dialogue is intimate, "
        "unhurried, slightly wry."
    ),
}


def build_system_prompt(vibe: str, deai_level: int, characters, lore) -> str:
    vibe_desc = VIBE_DESCRIPTORS.get(vibe, VIBE_DESCRIPTORS["poetic_slow_burn"])
    # de-ai level: 0 = safe/standard prose, 100 = aggressive anti-cliche
    deai_strictness = (
        "EXTREME" if deai_level >= 80
        else "HIGH" if deai_level >= 60
        else "MODERATE" if deai_level >= 30
        else "LIGHT"
    )

    char_block = ""
    if characters:
        lines = []
        for c in characters:
            line = f"- {c.get('name')}"
            if c.get("role"):
                line += f" ({c['role']})"
            if c.get("description"):
                line += f": {c['description']}"
            lines.append(line)
        char_block = "\n\nKNOWN CHARACTERS / LORE LOCKER:\n" + "\n".join(lines)

    lore_block = f"\n\nADDITIONAL WORLD/LORE:\n{lore}" if lore else ""

    return f"""You are an elite, award-winning fiction novelist and ghostwriter.
Your superpower is taking raw, unpolished human experiences, fragmented thoughts,
and incomplete words, and transforming them into immersive, deeply engaging
literary stories.

RULES — STRICT, NON-NEGOTIABLE:

1) ANTI-AI LANGUAGE FILTER ({deai_strictness}):
   - NEVER use these banned words/phrases: testament, beacon, profound, delve,
     embarked, tapestry, "little did they know", "in the heart of",
     "whispered secrets", "navigate the complexities", "stands as a", "weave",
     "myriad", "realm", "bustling", "nestled", "ever-evolving", "kaleidoscope".
   - Avoid generic AI transitions ("Furthermore", "Moreover", "In conclusion").
   - No grand summary statements about the meaning of the scene.
   - If a sentence sounds like it could appear in any AI essay, rewrite it.

2) SHOW, DON'T TELL (Golden Rule):
   - Never state emotion ("he was nervous"). Render it through bodies:
     sweating palms, a thumb worrying a hangnail, the wet click of a dry throat.
   - Ground every paragraph in sensory specifics: texture, scent, sound, light,
     temperature, weight. The reader must feel the room.

3) PACING & CHUNKING:
   - Write ONLY the next logical scene chunk (250–350 words).
   - Do not rush. Do not resolve. End on a hook or a held breath.
   - No chapter titles, no "—End of chunk—", no meta commentary. Just prose.

4) DIALOGUE & TONE:
   - Match speech to context: if the dump implies college kids, dialogue is
     colloquial, interrupted, half-formed. If it implies a war veteran, it is
     terse. Adapt.
   - Complete the user's fragments intuitively. Do not quote them verbatim —
     translate their raw thought into lived experience.

5) STORY VIBE — {vibe.upper().replace("_", " ")}:
   {vibe_desc}

{char_block}{lore_block}

Return ONLY the prose. No headers, no notes, no bullet points.
"""


# ----------------------------------------------------------------------------
# Auth routes
# ----------------------------------------------------------------------------
@api.post("/auth/signup", response_model=AuthResponse)
async def signup(req: SignupRequest):
    existing = await db.users.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": req.email.lower(),
        "display_name": req.display_name.strip(),
        "password_hash": hash_password(req.password),
        "created_at": now_utc_iso(),
    }
    await db.users.insert_one(doc)
    return AuthResponse(token=make_token(uid), user=user_to_out(doc))


@api.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email.lower()})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    return AuthResponse(token=make_token(user["id"]), user=user_to_out(user))


@api.get("/auth/me", response_model=UserOut)
async def me(u: dict = Depends(current_user)):
    return user_to_out(u)


# ----------------------------------------------------------------------------
# Story generation
# ----------------------------------------------------------------------------
async def _generate_chunk(
    system_prompt: str, session_id: str, user_msg: str
) -> str:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_prompt,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    response = await chat.send_message(UserMessage(text=user_msg))
    return response.strip() if isinstance(response, str) else str(response).strip()


@api.post("/story/generate")
async def story_generate(req: StoryGenerateRequest, u: dict = Depends(current_user)):
    story_id = str(uuid.uuid4())
    system_prompt = build_system_prompt(req.vibe, req.deai_level, req.characters, req.lore)

    user_msg = f"""[USER'S RAW BRAIN DUMP]
\"\"\"{req.brain_dump}\"\"\"

TASK: Write the captivating OPENING SCENE (250–350 words) based on this dump.
Complete fragments using deep imagination. Apply ALL rules strictly. End on a hook."""

    try:
        prose = await _generate_chunk(system_prompt, story_id, user_msg)
    except Exception as e:
        logger.exception("Generation failed")
        raise HTTPException(502, f"Story generation failed: {e}")

    title = (req.title or req.brain_dump[:60].strip().rstrip(".,!?") + "…").strip()
    doc = {
        "id": story_id,
        "user_id": u["id"],
        "title": title,
        "vibe": req.vibe,
        "deai_level": req.deai_level,
        "brain_dump": req.brain_dump,
        "chunks": [{"text": prose, "created_at": now_utc_iso(), "directive": None}],
        "characters": req.characters or [],
        "lore": req.lore or "",
        "is_public": False,
        "created_at": now_utc_iso(),
        "updated_at": now_utc_iso(),
    }
    await db.stories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.post("/story/continue")
async def story_continue(req: StoryContinueRequest, u: dict = Depends(current_user)):
    story = await db.stories.find_one({"id": req.story_id, "user_id": u["id"]})
    if not story:
        raise HTTPException(404, "Story not found")

    system_prompt = build_system_prompt(
        story["vibe"], story["deai_level"], story.get("characters"), story.get("lore")
    )

    # Rebuild context: prior prose + new directive
    prior = "\n\n".join(c["text"] for c in story["chunks"])
    directive = (
        f"\n\n[CO-AUTHOR DIRECTIVE FROM THE WRITER]:\n{req.coauthor_directive.strip()}\n"
        if req.coauthor_directive
        else ""
    )

    user_msg = f"""[STORY SO FAR]
\"\"\"{prior}\"\"\"
{directive}
TASK: Continue the story with the NEXT scene chunk (250–350 words).
Do not repeat what came before. Maintain voice, vibe, character consistency.
End on a hook or held breath."""

    try:
        prose = await _generate_chunk(system_prompt, req.story_id, user_msg)
    except Exception as e:
        logger.exception("Continue failed")
        raise HTTPException(502, f"Continue failed: {e}")

    chunk = {"text": prose, "created_at": now_utc_iso(), "directive": req.coauthor_directive}
    await db.stories.update_one(
        {"id": req.story_id},
        {"$push": {"chunks": chunk}, "$set": {"updated_at": now_utc_iso()}},
    )
    story = await db.stories.find_one({"id": req.story_id})
    story.pop("_id", None)
    return story


@api.get("/story/library")
async def story_library(u: dict = Depends(current_user)):
    cursor = db.stories.find({"user_id": u["id"]}, {"_id": 0}).sort("updated_at", -1)
    items = await cursor.to_list(500)
    # trim chunks for list view
    for s in items:
        s["preview"] = s["chunks"][0]["text"][:200] if s.get("chunks") else ""
        s["chunk_count"] = len(s.get("chunks", []))
        s["word_count"] = sum(len(c["text"].split()) for c in s.get("chunks", []))
    return items


@api.get("/story/{story_id}")
async def story_get(story_id: str, u: dict = Depends(current_user)):
    story = await db.stories.find_one(
        {"id": story_id, "$or": [{"user_id": u["id"]}, {"is_public": True}]},
        {"_id": 0},
    )
    if not story:
        raise HTTPException(404, "Story not found")
    return story


@api.delete("/story/{story_id}")
async def story_delete(story_id: str, u: dict = Depends(current_user)):
    res = await db.stories.delete_one({"id": story_id, "user_id": u["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Story not found")
    return {"ok": True}


@api.post("/story/share")
async def story_share(req: StoryShareRequest, u: dict = Depends(current_user)):
    res = await db.stories.update_one(
        {"id": req.story_id, "user_id": u["id"]},
        {"$set": {"is_public": req.share, "updated_at": now_utc_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Story not found")
    return {"ok": True, "is_public": req.share}


@api.get("/story/{story_id}/export")
async def story_export(story_id: str, fmt: str = "md", u: dict = Depends(current_user)):
    story = await db.stories.find_one(
        {"id": story_id, "$or": [{"user_id": u["id"]}, {"is_public": True}]},
        {"_id": 0},
    )
    if not story:
        raise HTTPException(404, "Story not found")
    if fmt == "md":
        body = f"# {story['title']}\n\n_Vibe: {story['vibe'].replace('_', ' ').title()}_\n\n"
        body += "\n\n---\n\n".join(c["text"] for c in story["chunks"])
    else:
        body = f"{story['title']}\n\n" + "\n\n".join(c["text"] for c in story["chunks"])
    return {"filename": f"{story['title'][:60]}.{fmt}", "content": body}


# ----------------------------------------------------------------------------
# Community feed
# ----------------------------------------------------------------------------
@api.get("/community/feed")
async def community_feed(u: dict = Depends(current_user)):
    cursor = db.stories.find({"is_public": True}, {"_id": 0}).sort("updated_at", -1).limit(60)
    items = await cursor.to_list(60)
    # attach author display names
    uids = list({s["user_id"] for s in items})
    users = await db.users.find({"id": {"$in": uids}}, {"_id": 0}).to_list(len(uids))
    name_map = {u["id"]: u["display_name"] for u in users}
    for s in items:
        s["author"] = name_map.get(s["user_id"], "Anonymous")
        s["preview"] = s["chunks"][0]["text"][:240] if s.get("chunks") else ""
        s["chunk_count"] = len(s.get("chunks", []))
    return items


# ----------------------------------------------------------------------------
# Characters & Lore Locker
# ----------------------------------------------------------------------------
@api.get("/characters")
async def characters_list(u: dict = Depends(current_user)):
    cursor = db.characters.find({"user_id": u["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(200)


@api.post("/characters")
async def characters_create(c: CharacterIn, u: dict = Depends(current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": u["id"],
        "name": c.name,
        "role": c.role or "",
        "description": c.description,
        "created_at": now_utc_iso(),
    }
    await db.characters.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/characters/{cid}")
async def characters_delete(cid: str, u: dict = Depends(current_user)):
    res = await db.characters.delete_one({"id": cid, "user_id": u["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Character not found")
    return {"ok": True}


# ----------------------------------------------------------------------------
# Daily prompts
# ----------------------------------------------------------------------------
DAILY_PROMPTS = [
    "Write about the smell of a room you can no longer enter.",
    "A stranger says your name like they've known you for years.",
    "The last thing your grandmother whispered before falling asleep.",
    "You find a note in your own handwriting that you don't remember writing.",
    "Two people share an umbrella but only one is wet.",
    "A song plays from a window. You stop walking. Why?",
    "Describe the silence between two people who used to love each other.",
    "The taste of a meal you'll never eat again.",
    "What the morning looks like from the wrong side of a sleepless night.",
    "A letter that was written but never sent.",
    "The way a room changes when one person leaves it forever.",
    "A photograph you keep face-down in a drawer.",
    "The weight of a key you no longer have a lock for.",
    "A sound you only hear when no one else is home.",
    "Something you owe someone, but they don't know it yet.",
]


@api.get("/prompts/daily")
async def daily_prompt():
    # deterministic per UTC day so it feels "daily" without DB state
    day = datetime.now(timezone.utc).date().toordinal()
    idx = day % len(DAILY_PROMPTS)
    return {"prompt": DAILY_PROMPTS[idx], "date": datetime.now(timezone.utc).date().isoformat()}


# ----------------------------------------------------------------------------
# Voice dump (Whisper)
# ----------------------------------------------------------------------------
@api.post("/voice/transcribe")
async def voice_transcribe(
    file: UploadFile = File(...),
    u: dict = Depends(current_user),
):
    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(400, "Empty audio file")
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(400, "Audio file exceeds 25MB limit")

    # OpenAISpeechToText expects a file-like; give it a BytesIO with a name attribute
    bio = io.BytesIO(raw)
    bio.name = file.filename or "voice.webm"

    try:
        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
        response = await stt.transcribe(file=bio, model="whisper-1", response_format="json")
        text = getattr(response, "text", None) or str(response)
    except Exception as e:
        logger.exception("Transcription failed")
        raise HTTPException(502, f"Transcription failed: {e}")

    return {"text": text}


# ----------------------------------------------------------------------------
# Health
# ----------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"app": "InkDrop", "ok": True}


# ----------------------------------------------------------------------------
# Boot
# ----------------------------------------------------------------------------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_start():
    await db.users.create_index("email", unique=True)
    await db.stories.create_index([("user_id", 1), ("updated_at", -1)])
    await db.characters.create_index([("user_id", 1), ("created_at", -1)])
    logger.info("InkDrop API ready.")


@app.on_event("shutdown")
async def on_stop():
    client.close()
