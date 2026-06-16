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

## Implementation Status — 2026-01-11
- [x] JWT auth (signup/login/me) with bcrypt + idempotent email index
- [x] Story generate/continue (Claude Sonnet 4.5, multi-turn session_id reuse)
- [x] Story library, get, delete, share, export
- [x] Voice transcription endpoint (Whisper-1)
- [x] Characters CRUD
- [x] Daily prompt endpoint
- [x] Community feed endpoint
- [x] Landing, Auth, Dashboard, Compose, Reader, Library, Community pages
- [x] Dark editorial design system (Cormorant Garamond + Lora, parchment textures)
- [x] Backend tested: 18/18 pytest pass
- [x] Frontend tested: core flows pass; minor UI sync fixes applied (char locker refresh, Dashboard focus refetch)

## Backlog / Next
- **P1** Streaming SSE for story generation (token-by-token render)
- **P1** Inline edit of generated chunks
- **P1** Story cover art (Nano Banana — could be auto-generated based on vibe + title)
- **P2** Multi-character POV mode
- **P2** Reading time + listen-to-story (TTS)
- **P2** Salon: likes, comments, follow other writers
- **P2** Refactor server.py into routers (auth/story/characters/voice/community)
- **P2** Server-side word-count enforcement / regenerate if drift
- **P2** Premium plan / Stripe for unlimited generations

## Test Credentials
See `/app/memory/test_credentials.md`
