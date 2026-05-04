# CLAUDE.md — Trig Tutor MVP

This file is the source of truth for all AI agents (Claude Code, Cursor) working on this codebase.
Read it fully before making any changes. Update the decisions log at the bottom whenever you make
a non-trivial architectural choice.

---

## Project overview

A Socratic trigonometry tutor that helps students learn by guiding them through problems
step-by-step — never giving away the answer, always asking the next question.

**Core teaching philosophy**

The AI never solves the problem for the student. It evaluates each step, identifies the
misconception, and asks a guiding question that leads the student to discover the correct
next step themselves.

**Core technical philosophy — read carefully**

Math correctness is judged by a **deterministic symbolic engine (SymPy)**, not by the LLM.
The LLM's only job is to generate the Socratic *hint* once we already know whether the step
was right or wrong. This is the single most important architectural decision in the project
and the reason it can be trusted by students.

```
Student step → Normalize (LaTeX → SymPy) → SymPy verdict (correct / incorrect / equivalent)
                                              ↓
                                        LLM generates Socratic hint (with verdict as input)
                                              ↓
                                        Show to student
```

The LLM never decides if the answer is right. SymPy does. This eliminates the flakiness of
LLMs sometimes saying "1/√2 is wrong" when the expected answer is "√2/2" — they are
mathematically equivalent and SymPy knows it.

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | TypeScript throughout |
| Styling | Tailwind CSS | No component libraries for MVP |
| Math rendering | **KaTeX** via `react-katex` | Fast, synchronous, ~350KB bundle |
| Math input keyboard | **MathLive** (`mathlive` npm package) | Open-source, touch-friendly, outputs LaTeX, includes speech parsing |
| OCR (problems) | **Mathpix API** for MVP, optional fallback to **Pix2Text** | Mathpix has free tier; Pix2Text is a fully open-source Python alternative we self-host later |
| OCR (handwritten answers) | **Surya** (formerly Texify) — Python microservice | Better than Mathpix on handwriting; runs locally |
| Voice input | **Web Speech API** (browser-native) | Free, real-time. Whisper.cpp swap-in available later |
| Spoken math → LaTeX | **MathLive's speech parser** | Avoids LLM round-trip for voice; deterministic |
| **Math validation engine** | **SymPy** (Python microservice) | The judge of correctness. Non-negotiable. |
| AI hint generation | Anthropic Claude API (`claude-sonnet-4-5`) | Only generates Socratic hints; never decides correctness |
| State | React `useState` / `useReducer` | No external state lib for MVP |
| Backend | Next.js API routes + Python sidecar for SymPy | FastAPI for the Python service |
| Deployment | Vercel (Next.js) + Fly.io or Railway (Python service) | Two-service deploy is unavoidable due to SymPy |

---

## Project structure

```
helper/
├── app/                              # Next.js frontend + API
│   ├── page.tsx                      # Landing / problem selection
│   ├── solve/
│   │   └── [problemId]/
│   │       └── page.tsx              # Main solving UI
│   ├── confirm-ocr/
│   │   └── page.tsx                  # Student confirms extracted problem before solving
│   └── api/
│       ├── ocr/
│       │   └── route.ts              # POST: image → extracted LaTeX (calls Mathpix)
│       ├── validate/
│       │   └── route.ts              # POST: step → SymPy verdict (calls Python service)
│       ├── hint/
│       │   └── route.ts              # POST: verdict + context → Socratic hint (calls Claude)
│       └── problems/
│           └── route.ts              # GET: list of trig problems
├── components/
│   ├── ImageUpload.tsx               # Drag/drop + camera capture
│   ├── OcrConfirmation.tsx           # Shows extracted problem; student edits if wrong
│   ├── VoiceInput.tsx                # Web Speech API + MathLive speech parser
│   ├── MathInput.tsx                 # MathLive component for keyboard/touch input
│   ├── MultipleChoice.tsx            # MCQ scaffolding option
│   ├── StepList.tsx                  # Shows prior steps + correctness markers
│   ├── FeedbackBubble.tsx            # Socratic hint display
│   └── ProblemDisplay.tsx            # Renders LaTeX problem via KaTeX
├── lib/
│   ├── mathpix.ts                    # Mathpix API client
│   ├── claude.ts                     # Claude API client (hint generation only)
│   ├── validator.ts                  # Calls Python SymPy service
│   ├── prompts.ts                    # Socratic hint prompts (LOCKED — see below)
│   ├── stepParser.ts                 # Defines what a "step" is
│   ├── rateLimit.ts                  # Per-session call guards
│   └── types.ts                      # Shared TypeScript types
├── hooks/
│   ├── useVoiceInput.ts              # Speech recognition hook
│   └── useSolveSession.ts            # Step session state machine
├── data/
│   └── problems.ts                   # Seed problems with canonical solutions
├── python-service/                   # SymPy microservice (FastAPI)
│   ├── main.py                       # /validate, /equivalent, /simplify endpoints
│   ├── trig_validator.py             # Trig-specific validation logic
│   ├── latex_parser.py               # LaTeX → SymPy expression
│   ├── requirements.txt
│   └── Dockerfile
├── CLAUDE.md                         # This file
└── .env.local                        # API keys (never commit)
```

---

## Core data types

```typescript
// lib/types.ts

type Problem = {
  id: string
  title: string
  latex: string                       // e.g. "\\sin(30°) = ?"
  topic: TrigTopic
  difficulty: 'intro' | 'practice' | 'challenge'
  canonicalSteps: CanonicalStep[]     // expert solution path; SymPy uses these as targets
  finalAnswer: string                 // LaTeX of expected final answer
}

type CanonicalStep = {
  index: number
  description: string                 // human-readable description ("apply Pythagorean identity")
  expectedExpression: string          // LaTeX of the expression after this step
  conceptTag: TrigConcept
  acceptableForms: string[]           // alternative LaTeX forms students might write
}

type TrigTopic =
  | 'unit_circle'
  | 'sin_cos_tan'
  | 'pythagorean_identity'
  | 'special_angles'
  | 'inverse_functions'
  | 'solving_equations'

type TrigConcept = string             // e.g. "pythagorean_identity", "sohcahtoa"

type Step = {
  id: string
  rawInput: string                    // exactly what student wrote/spoke
  latex: string                       // normalized LaTeX
  inputMethod: 'voice' | 'keyboard' | 'ocr' | 'mcq'
  validation: ValidationResult | null
  hint: HintResult | null
  timestamp: number
}

type ValidationResult = {
  status: 'correct' | 'incorrect' | 'unparseable' | 'equivalent_to_earlier'
  matchedCanonicalStep: number | null // which expert step this corresponds to
  detectedConcept: TrigConcept | null
  symbolicForm: string                // SymPy's normalized form
  reason: string                      // machine-readable, e.g. "missing_factor", "sign_error"
}

type HintResult = {
  socraticHint: string                // the guiding question to show the student
  encouragement: string               // short positive note
  conceptToReview: TrigConcept | null
}

type SolveSession = {
  problemId: string
  steps: Step[]
  solved: boolean
  startedAt: number
  apiCallCount: number                // for rate limiting
}
```

---

## Definition of a "step"

This was undefined in v1 and caused ambiguity. A step is:

> A single logical transformation that produces a new mathematical expression
> from the previous one, OR a final answer assignment.

**Examples of valid single steps:**
- `sin²θ + cos²θ = 1` → `cos²θ = 1 - sin²θ` (apply identity)
- `cos²θ = 1 - 1/4` (substitute known value)
- `cos θ = √3/2` (take square root, choose positive root)
- `x = 5` (final answer)

**Examples of multi-step input that should be split:**
- "sin 30 = 1/2, so x = 5" → two steps
- "Using SOHCAHTOA, opposite/hypotenuse = sin θ, so 3/5 = sin θ, so θ = arcsin(3/5)" → three steps

When student input contains multiple equations or commas/semicolons separating
expressions, `lib/stepParser.ts` must split them and validate each independently.

---

## API routes

### POST /api/ocr

Accepts a multipart form with an image file. Sends to Mathpix. Returns extracted LaTeX
**plus a confidence score** so the UI can flag low-confidence extractions.

```typescript
// Request
FormData: { image: File }

// Response
{
  latex: string,
  confidence: number,      // 0-1; below 0.85 → force confirmation step
  rawText: string,
  needsConfirmation: boolean
}
```

After this returns, the student is **always** routed to `/confirm-ocr` where they see the
extracted problem rendered via KaTeX and can edit it before starting. This catches OCR
errors that would otherwise corrupt the entire session.

### POST /api/validate

The deterministic correctness check. Hits the Python SymPy service. **Does not call Claude.**

```typescript
// Request
{
  problemId: string,
  previousLatex: string,    // expression at end of previous step
  newStepLatex: string,     // student's latest step
  expectedFinalAnswer: string
}

// Response
{
  status: 'correct' | 'incorrect' | 'unparseable' | 'equivalent_to_earlier',
  matchedCanonicalStep: number | null,
  detectedConcept: string | null,
  symbolicForm: string,
  reason: string
}
```

### POST /api/hint

Generates the Socratic hint *given* the validation result. Calls Claude.

```typescript
// Request
{
  problem: Problem,
  allSteps: Step[],
  newStep: Step,            // includes validation result
}

// Response
{
  socraticHint: string,
  encouragement: string,
  conceptToReview: string | null
}
```

### Rate limiting

`/api/hint` is rate-limited to 30 calls per session, 100 per IP per hour.
`/api/validate` is rate-limited to 60 calls per session, 200 per IP per hour.
Enforce in `lib/rateLimit.ts` using an in-memory map for MVP (Redis later).

---

## Python SymPy service

A small FastAPI service that does the actual math. Runs as a separate container.

### Endpoints

**POST /validate** — full validation flow
```python
# Request
{
  "previous_latex": "\\sin^2(\\theta) + \\cos^2(\\theta) = 1",
  "new_step_latex": "\\cos^2(\\theta) = 1 - \\sin^2(\\theta)",
  "expected_final": "x = 5",
  "canonical_steps": [...]  # from problem definition
}

# Response
{
  "status": "correct",
  "matched_canonical_step": 1,
  "symbolic_form": "Eq(cos(theta)**2, 1 - sin(theta)**2)",
  "reason": "valid_algebraic_transformation"
}
```

**POST /equivalent** — checks if two LaTeX expressions are mathematically equivalent
```python
# Request
{ "a": "\\frac{1}{\\sqrt{2}}", "b": "\\frac{\\sqrt{2}}{2}" }
# Response
{ "equivalent": true }
```

**POST /simplify** — returns simplest form
```python
# Request
{ "latex": "\\sin^2(x) + \\cos^2(x)" }
# Response
{ "simplified": "1", "latex": "1" }
```

### Validation algorithm

1. Parse both `previous_latex` and `new_step_latex` to SymPy expressions
   using `sympy.parsing.latex.parse_latex`.
2. Compute `simplify(previous_expr - new_step_expr)`.
3. If equal to zero → step is a valid identity transformation. Return `correct`.
4. If not, check whether `new_step_expr` matches any `canonical_steps[i].expected_expression`.
5. If yes → student took a different but valid path. Return `correct` with matched index.
6. If still no match, check if `new_step_expr` is the final answer. If yes, return `correct`.
7. Otherwise → `incorrect`. Run heuristics to detect common error patterns
   (sign errors, off-by-one in exponents, wrong identity application) and return the
   `reason` tag.

### Common trig equivalences SymPy already handles

- `sin²θ + cos²θ ↔ 1`
- `1/√2 ↔ √2/2 ↔ √(1/2)`
- `2·sin(x)·cos(x) ↔ sin(2x)`
- `cos²(x) - sin²(x) ↔ cos(2x)`
- Decimal approximations (`0.5 ↔ 1/2`)

For SymPy to recognize trig identities, always wrap simplification with
`trigsimp()` rather than just `simplify()`.

---

## The Socratic hint prompt

Lives in `lib/prompts.ts`. **Locked — do not modify without discussion.**

The prompt receives the SymPy verdict as input. It does not decide correctness;
it only decides *what to say*.

```typescript
export const SOCRATIC_HINT_SYSTEM_PROMPT = `
You are a patient Socratic tutor helping a high-school student learn trigonometry.

You will be given:
- The original problem
- All the steps the student has written so far
- The student's most recent step
- A verdict from a symbolic math engine (already computed) saying whether the step is correct
- The trig concept this step involves

Your job: write a SHORT guiding response (1-2 sentences) following these rules.

If the verdict is "correct":
- Confirm warmly without revealing what comes next.
- Ask a question that prompts them toward the next step.
- Reference the concept by name when natural.

If the verdict is "incorrect":
- Do NOT tell them what the right answer is.
- Do NOT tell them what step to take next.
- Identify the specific misconception based on the "reason" field.
- Ask a question that surfaces the misconception so they can find it themselves.

If the verdict is "unparseable":
- Ask them gently to clarify or rewrite their step.

Always include a short encouraging phrase, even when wrong.

Respond ONLY in this exact JSON format:
{
  "socraticHint": "Your 1-2 sentence guiding question",
  "encouragement": "Short positive phrase",
  "conceptToReview": "concept_tag" or null
}

Rules you must never break:
1. NEVER state the answer or next step.
2. NEVER write a full worked solution.
3. NEVER say "the answer is..." even partially.
4. Keep it under 40 words total.
`

export const buildHintUserPrompt = (
  problem: Problem,
  allSteps: Step[],
  newStep: Step
): string => `
Problem: ${problem.latex}
Topic: ${problem.topic}

Previous steps:
${allSteps.slice(0, -1).map((s, i) => 
  `${i + 1}. ${s.latex} — ${s.validation?.status}`
).join('\n')}

Student's new step: ${newStep.latex}

Symbolic engine verdict: ${newStep.validation?.status}
Reason: ${newStep.validation?.reason}
Detected concept: ${newStep.validation?.detectedConcept}
`
```

---

## Voice input flow

1. Student holds the mic button. Web Speech API starts with `interimResults: true`.
2. Live transcript shown on screen as they speak.
3. On release, the transcript is passed to MathLive's speech parser
   (`MathfieldElement.fromSpokenText()` or equivalent) which converts spoken math to LaTeX.
4. The LaTeX is shown in the input field. Student can edit before submitting.
5. **No Claude API call for voice → LaTeX.** This was a flaw in v1.

If MathLive's parser fails on a particular phrasing, fall back to a small lookup table of
common trig phrases (`"sine of thirty degrees"` → `\sin(30°)`) defined in
`lib/spokenMathDict.ts`.

---

## Image upload + OCR flow

1. Student drops or captures an image → `ImageUpload.tsx` reads as base64.
2. POST to `/api/ocr` with the file.
3. Server sends to Mathpix `/v3/text` endpoint.
4. Returns `latex` and `confidence`.
5. **Always route to `/confirm-ocr`** — student sees extracted problem rendered via KaTeX
   alongside the original image, and can edit the LaTeX directly using a MathLive field.
6. Only after confirmation does the solving session start.
7. If `confidence < 0.85`, show a warning banner: "We're not 100% sure we read this right —
   please double-check before solving."

```typescript
// lib/mathpix.ts
const response = await fetch('https://api.mathpix.com/v3/text', {
  method: 'POST',
  headers: {
    'app_id': process.env.MATHPIX_APP_ID!,
    'app_key': process.env.MATHPIX_APP_KEY!,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    src: `data:image/jpeg;base64,${base64Image}`,
    formats: ['latex_simplified', 'text'],
    math_inline_delimiters: ['$', '$']
  })
})
```

---

## Math rendering

Always render student-facing LaTeX with **KaTeX** via `react-katex`:

```tsx
import { InlineMath, BlockMath } from 'react-katex'
import 'katex/dist/katex.min.css'

<BlockMath math={problem.latex} />
```

Never render raw LaTeX strings. Never use `dangerouslySetInnerHTML`. KaTeX has built-in
XSS protection.

---

## Math input

Always use **MathLive** (`<math-field>` web component) for keyboard input:

```tsx
import 'mathlive'
import { MathfieldElement } from 'mathlive'

// MathLive provides:
// - Touch-friendly virtual keyboard
// - LaTeX output via .value or .getValue('latex')
// - Speech recognition mode
// - Symbol palette for trig functions, π, θ, fractions, square roots
```

Configure the virtual keyboard to show trig-relevant keys: `sin`, `cos`, `tan`, `θ`, `π`,
fractions, square roots, exponents, and degree symbols.

---

## Environment variables

```bash
# .env.local
ANTHROPIC_API_KEY=                    # Claude API key (hint generation only)
MATHPIX_APP_ID=                       # Mathpix app ID
MATHPIX_APP_KEY=                      # Mathpix app key
PYTHON_SERVICE_URL=                   # URL of the SymPy service (e.g. http://localhost:8000)
PYTHON_SERVICE_TOKEN=                 # Shared secret for Next.js → Python auth
```

---

## Seed problems (MVP)

Start with 10 problems covering these topics in order. Every problem must include
`canonicalSteps` and `acceptableForms` for SymPy.

1. sin/cos/tan of special angles (30°, 45°, 60°, 90°)
2. Using the Pythagorean identity (sin²θ + cos²θ = 1)
3. Finding an unknown side with SOH-CAH-TOA
4. Solving a basic trig equation (e.g. sin x = √2/2)
5. Reading values from the unit circle
6. Co-function identities
7. Right-triangle word problem (ladder, shadow, ramp)
8. Solving for an angle using inverse trig
9. Quadrant / sign reasoning
10. Two-step problem combining identity + algebra

For each problem, write the solution by hand first, then encode every step into
`canonicalSteps`. SymPy needs these to recognize a valid solution path.

---

## Coding conventions

- All components are functional with typed props interfaces
- API routes use `NextRequest` / `NextResponse` from `next/server`
- Error states must be handled at every API boundary — never silently fail
- LaTeX rendering uses **KaTeX** (not MathJax) — lighter and faster
- No `any` types — use `unknown` and narrow explicitly
- Loading states on every async operation (voice, OCR, validation, hint)
- Python service uses Pydantic models for all request/response bodies
- All SymPy LaTeX parsing wrapped in try/except — return `unparseable` status, never crash

---

## What NOT to build in MVP

Do not build these until the core loop is solid:

- User accounts / auth
- Progress tracking / history
- Curriculum sequencing
- Leaderboards or gamification
- Mobile app
- Multiple languages
- Teacher dashboard
- Custom problem authoring UI

---

## Definition of MVP done

The MVP is complete when a student can:

1. Upload a photo of a trig problem OR select from the seed list.
2. Confirm the OCR-extracted problem before solving begins.
3. Submit answer steps via voice, keyboard (MathLive), or multiple choice.
4. Have each step deterministically validated by SymPy.
5. Receive a Socratic hint after each step (never the answer itself).
6. Complete a full problem with correct step-by-step guidance.
7. See which steps were correct, equivalent, or needed correction.

A successful MVP test: a student can complete `sin(2x) = 1, find x` over 4-5 steps,
write `1/√2` where the problem expected `√2/2`, and the system correctly accepts it.

---

## Key decisions log

| Decision | Rationale |
|---|---|
| **SymPy as judge, Claude as teacher** | LLMs are non-deterministic on math correctness; SymPy is exact. This split is the foundation of trust in the product. |
| KaTeX over MathJax | Faster, smaller bundle (~350KB), synchronous rendering, sufficient for high-school trig |
| MathLive over MathQuill | MathQuill is unmaintained; MathLive is actively developed, has built-in speech parsing, and is touch-friendly |
| MathLive speech parser over Claude for voice → LaTeX | Removes 1-2s of latency per step and avoids token cost; deterministic |
| Mathpix for MVP, Pix2Text as fallback path | Mathpix is reliable out of the box; Pix2Text is the open-source escape hatch if costs rise |
| Surya for handwritten answers | Better than Mathpix on handwriting; runs locally |
| OCR confirmation step is mandatory | OCR errors corrupting an entire session is the #1 trust killer; cheap to fix with one screen |
| Definition of "step" written explicitly | Without this, validation is ambiguous and AI agents make inconsistent choices |
| Rate limiting from day one | One student playing around can otherwise generate hundreds of API calls |
| Python sidecar service | Unavoidable — SymPy is Python-only and far more capable than any JS equivalent |
| Web Speech API for STT | Free, real-time, zero setup; Whisper.cpp swap-in path documented |
| `trigsimp()` not `simplify()` | SymPy needs the trig-specific simplifier to recognize identities like sin²+cos²=1 |
| `X-Session-Id` header for per-session limits (MVP) | Enables deterministic per-session request caps in API routes without introducing auth/user accounts |
| OCR-imported problems stored in browser localStorage (MVP) | Preserves the mandatory OCR confirmation → solve flow without adding a backend persistence layer yet |
| Forward skip-ahead + `skip_not_derivable` heuristic | Multi-step skips must share symbols or function heads with `previous_latex`, or be an identity from it; single-step skip is always allowed. Blocks pasted late canonical lines with no link to prior work. |
| OCR solve sessions send real `canonicalSteps` / `finalAnswer` to `/api/validate` | When `/api/generate-steps` succeeds on confirm-ocr, stripping them for `ocr-*` ids prevented SymPy from using that path; Python already chooses lenient mode when lists are empty. |
| `sourceImageDataUrl` on imported `Problem` | OCR only stored LaTeX + structured `diagram` JSON; the raster was dropped after confirm. Persisting a data URL (full or downscaled) lets the solve page show **Original figure** beside KaTeX. |
