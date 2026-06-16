# InkDrop — Product Requirements Document

## Original Problem Statement
Build an "elite ghostwriter" web app that turns a user's raw "Brain Dump" (fragmented thoughts / memories / voice) into immersive literary fiction. Strict rules: anti-AI language filter, show-don't-tell, chunked pacing (250–350 words), dialogue/tone adapted to a chosen "Story Vibe" (Dark & Gritty, Poetic Slow-Burn, Fast-Paced Thriller, Cozy Nostalgic).

## User Choices (locked)
- **App name:** InkDrop
- **LLM:** Claude Sonnet 4.5 (`anthropic / claude-sonnet-4-5-20250929`) via Emergent Universal LLM Key
- **Voice STT:** OpenAI Whisper-1 via Emergent Universal LLM Key
- **Auth:** JWT email/password (bcrypt)
- **Design:** Dark editorial (Cormorant Garamond + Lora, parchment textures, oxblood + bone palette)
- **Features approved:** Vibe presets, Continue Story, Save to Library, Export MD/TXT, User accounts, Voice Dump, Co-Author Mode, Character & Lore Locker, De-AI-fy Slider, Digital Bookshelf, Daily Imagination Prompts, Community Salon

## Architecture
- **Backend** FastAPI + Motor (MongoDB) + emergentintegrations (LlmChat for Claude, OpenAISpeechToText for Whisper). Single `server.py`, all routes under `/api`.
- **Frontend** React 19 + react-router-dom v7 + Tailwind + framer-motion + lucide-react + custom CSS.
- **Storage** Collections: `users`, `stories` (with embedded `chunks[]`), `characters`.

## Personas
- *The Journaler* — wants to turn end-of-day thoughts into narrative entries
- *The Aspiring Novelist* — wants chunked drafting with anti-AI prose hygiene
- *The Voice Thinker* — prefers speaking ideas, gets them rendered as scenes

## Core Requirements (static)
1. Brain Dump → Opening Scene (250–350 words, Claude 4.5)
2. Continue Story chunk-by-chunk, session-coherent
3. Co-Author directive injection between chunks
4. Story Vibe presets influencing system prompt
5. De-AI-fy slider (0–100) tightens anti-cliché strictness
6. Voice Dump → Whisper-1 transcription back into the textarea
7. Character/Lore Locker passed into system prompt at generation
8. Daily Imagination Prompt (deterministic per UTC day)
9. Personal Bookshelf with vibe/word/chunk metadata
10. Community Salon (public-shared stories)
11. Export Markdown / Plain Text

## Implementation Status — 2026-01-16 (iteration 2)
- [x] JWT auth (signup/login/me) with bcrypt + idempotent email index
- [x] Story generate/continue (Claude Sonnet 4.5, multi-turn session_id reuse)
- [x] Story library, get, delete, share, export
- [x] Voice transcription endpoint (Whisper-1)
- [x] Characters CRUD
- [x] Daily prompt endpoint
- [x] Community feed endpoint
- [x] Landing, Auth, Dashboard, Compose, Reader, Library, Community pages
- [x] Dark editorial design system (Cormorant Garamond + Lora, parchment textures)
- [x] **SSE streaming**: `/story/generate/stream` + `/story/continue/stream` — token-by-token live render
- [x] **Auto cover art (Gemini Nano Banana, gemini-3.1-flash-image-preview)** — background task fired after every story creation, polled via `/story/{id}/cover`, regenerable via `/story/{id}/cover/regenerate`
- [x] **Inline chunk edit**: PATCH `/story/{id}/chunks/{idx}` + Reader hover-pencil UI
- [x] Library + Community show 3:4 cover thumbnails (lazy-loaded, vibe-gradient fallback)
- [x] Tested: 28/28 backend pytest; full frontend e2e on preview URL

## Backlog / Next
- **P1** Auto-cancel Claude stream when client disconnects (poll `Request.is_disconnected()` in event_gen) — currently a long stream keeps billing if user closes the tab
- **P1** Move cover_b64 from MongoDB doc → GridFS or S3 (1MB+ per story bloats `stories` collection)
- **P2** Per-user rate limit on SSE endpoints (in-memory token bucket)
- **P2** Refactor `server.py` (~850 lines) into routers: `auth_router.py`, `story_router.py`, `cover_router.py`, `characters_router.py`, `voice_router.py`
- **P2** Multi-character POV mode
- **P2** Listen-to-story (OpenAI TTS) — pair with our literary prose
- **P2** Salon: likes, comments, follow other writers
- **P2** Premium plan / Stripe for unlimited generations + premium cover models

## Test Credentials
See `/app/memory/test_credentials.md`
