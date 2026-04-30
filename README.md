# Trig Tutor MVP

A Socratic trigonometry tutor that helps students learn by guiding them through problems
step-by-step — never giving away the answer.

> **The architectural rule:** the LLM never decides if a step is right. SymPy does.
> See `CLAUDE.md` for the full design contract.

This repo is a scaffold — every file referenced in `CLAUDE.md` exists with a stub
implementation so an agent or developer can fill in real logic incrementally without
fighting the project shape.

## Two services

```
trig-tutor/                 ← Next.js 14 app (frontend + API routes)
└── python-service/         ← FastAPI + SymPy validator (separate container)
```

Both must be running locally for the full flow to work.

## Quick start

### 1. Install Node deps

```bash
npm install
cp .env.local.example .env.local
# then edit .env.local with real keys
```

### 2. Install Python deps

```bash
cd python-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Run both services

In one terminal:

```bash
npm run python:dev
# starts FastAPI at http://localhost:8000
```

In another terminal:

```bash
npm run dev
# starts Next.js at http://localhost:3000
```

## What's stubbed vs. real

Everything is wired together (types, routes, calls between services), but the actual
math/AI logic is stubbed and clearly marked with `TODO` comments. Concretely:

- API routes parse + validate inputs but return mocked verdicts/hints.
- `python-service` parses LaTeX with `sympy.parsing.latex.parse_latex` and has the
  validation algorithm sketched out, but heuristics for `reason` tags are stubbed.
- Components render but don't yet wire up to real APIs end-to-end.
- `data/problems.ts` has 1 fully-encoded problem and 9 placeholders.

## Where to start filling in

1. `python-service/trig_validator.py` — the heart of the product.
2. `data/problems.ts` — flesh out the 9 placeholder problems with real `canonicalSteps`.
3. `app/solve/[problemId]/page.tsx` — wire up the full session UI.
4. `lib/stepParser.ts` — splitting multi-step student input.

## See also

`CLAUDE.md` — the source-of-truth design doc. Read it before changing architecture.
