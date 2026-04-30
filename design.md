# Trig Tutor UI Design Spec for Stitch

Use this document as the design brief/prompt context for Stitch so it generates UI that fits this codebase, product philosophy, and existing technical constraints.

## Product Summary

Trig Tutor is a Socratic trigonometry tutor for high-school students.

Core promise:
- Never give away the answer.
- Validate math deterministically with SymPy.
- Use AI only for concise guiding hints.

The UI should feel:
- Calm, supportive, and confidence-building.
- Clear about correctness without being punitive.
- Fast for iterative step-by-step input.

## Existing Technical Constraints (must match)

- Framework: Next.js 14 App Router + TypeScript.
- Styling: Tailwind CSS only.
- Math display: KaTeX (`react-katex`).
- Math input: MathLive (`<math-field>`), with explicit show/hide keyboard button.
- Voice: push-to-talk button using Web Speech API.
- OCR flow: upload image -> mandatory confirmation screen -> solve.
- Avoid heavy component libraries; output should be plain React + Tailwind patterns.

## Visual Direction

Use a clean "educational productivity" style:
- Background: soft neutral (`slate-50` family).
- Cards: white with subtle borders and shadows.
- Primary action: blue (`blue-600`/`blue-700`).
- Semantic status colors (already used in codebase):
  - correct: green
  - incorrect: red
  - equivalent: blue
  - unparseable/warning: amber
- Typography:
  - Headings: bold, compact.
  - Body: high readability, medium contrast.
  - Helper text: smaller, muted, never too faint.

Tone in UI copy:
- Supportive and non-judgmental.
- Replace harsh phrasing with gentle alternatives.
- Keep guidance short and actionable.

## App Information Architecture

Generate polished UI for these core screens:

1. Home (`/`)
- Header with app title + one-sentence value prop.
- "Upload a problem" card with drag/drop target.
- "Pick a practice problem" grid of problem cards.
- Problem card fields:
  - topic and difficulty pill/text
  - title
  - rendered latex preview

2. OCR Confirmation (`/confirm-ocr`)
- Two-column layout on desktop, stacked on mobile.
- Left: original uploaded image preview.
- Right: extracted LaTeX rendered preview.
- Editable MathLive field below.
- If low confidence or OCR not configured: warning banner.
- Clear primary CTA: "Looks right - start solving".

3. Solve Session (`/solve/[problemId]`)
- Top section:
  - topic + difficulty
  - problem title
  - rendered problem statement
- Middle:
  - step history list (status-tagged cards)
  - latest tutor feedback bubble
- Input section:
  - math input field (MathLive)
  - show/hide keyboard toggle
  - submit step button
  - voice input button ("Hold to talk")
  - optional MCQ helper actions
- Completion state:
  - celebratory but simple success panel.

## Component-Level Design Requirements

### Step List
- Each step in a rounded card with:
  - Step number
  - status label (Correct, Needs another look, Try rephrasing, Same as earlier)
  - rendered math expression
- Status should be color-coded but still readable in grayscale.

### Feedback Bubble
- Distinct "Tutor" container style.
- Show:
  - Socratic hint (primary text)
  - encouragement (secondary text)
  - concept-to-review tag if present
- Keep line lengths short for scanability.

### Math Input Area
- Math field always prominent and full-width.
- Keyboard toggle and submit button should be visible without scrolling on common laptop sizes.
- Mobile-first spacing so virtual keyboard does not make controls unusable.

### Voice Input
- Button states:
  - idle: "Hold to talk"
  - recording: "Listening..."
  - processing: "Processing..."
- Show lightweight transcript text near button.

## UX Principles to Enforce

- One clear primary action per section.
- Never show dead-end states; always include a recovery action.
- Error states should include what to do next.
- Keep student in flow: submit -> validation -> hint -> next attempt quickly.
- Avoid visual clutter and long paragraphs.

## Responsive Behavior

- Mobile (<640px):
  - single-column layouts
  - sticky-ish input affordances where possible
  - generous tap targets
- Tablet/desktop:
  - cards and panels with comfortable whitespace
  - OCR confirmation in 2-column split

## Accessibility Requirements

- Sufficient color contrast for status states.
- Semantic headings and landmarks.
- Clear button labels and focus styles.
- Status should not rely on color alone (text labels required).

## Stitch Output Expectations

Ask Stitch to generate:
- High-fidelity UI mockups for the 3 screens above.
- A small design system section:
  - color tokens
  - spacing scale
  - component variants (button, card, banner, status chip)
- Empty/loading/error examples for each screen.
- Mobile and desktop variants.

## Guardrails (important)

- Do not redesign core flows (upload -> confirm -> solve must remain).
- Do not propose replacing MathLive or KaTeX.
- Do not introduce gamification, auth, or dashboard features in MVP UI.
- Keep the experience tutoring-first, not chat-app-first.

## Optional Prompt Snippet for Stitch

"Design a polished, production-ready UI for a Socratic trigonometry tutor web app (Next.js + Tailwind). Keep the existing architecture and flows: home problem selection/upload, mandatory OCR confirmation, and step-by-step solving with deterministic correctness statuses and concise tutor hints. Prioritize calm educational UX, responsive layouts, accessibility, and clear status feedback without being punitive."
