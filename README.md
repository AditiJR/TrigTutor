# TrigTutor

A Socratic trig tutor. Students submit steps, SymPy checks correctness, the LLM only writes the hint.

The LLM never decides if an answer is right — SymPy does.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **FastAPI + SymPy** — Python sidecar for deterministic math validation
- **MathLive** — math keyboard input
- **KaTeX** — math rendering
- **Gemini Vision** — image-to-LaTeX OCR (free tier)
- **Anthropic Claude** — Socratic hint generation only

## Setup

### 1. Frontend

```bash
npm install
cp .env.local.example .env.local
# fill in keys
npm run dev
```

### 2. Python service

```bash
cd python-service
python -m venv helper
source helper/bin/activate
pip install -r requirements.txt
PYTHON_SERVICE_TOKEN=dev-shared-secret-change-me uvicorn main:app --reload --port 8000
```

### 3. Env vars

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude hint generation |
| `GOOGLE_AI_API_KEY` | Gemini Vision OCR — [get a free key](https://aistudio.google.com/apikey) |
| `PYTHON_SERVICE_URL` | URL of the FastAPI service (default: `http://localhost:8000`) |
| `PYTHON_SERVICE_TOKEN` | Shared secret between Next.js and the Python service |

OCR works without any key — the confirm screen lets students type problems manually.

## How it works

```
Student step → SymPy validates → Claude writes Socratic hint
```

Image upload → Gemini extracts LaTeX + diagram facts → student confirms → solve session starts.

## Project layout

```
app/           Next.js pages + API routes
components/    UI components
lib/           API clients, types, utilities
hooks/         React hooks (voice input, solve session state)
python-service/  FastAPI + SymPy validator
data/          10 seed trig problems with canonical step encodings
```

See `CLAUDE.md` for the full architecture and decision log.
