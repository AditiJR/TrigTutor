❯ 1. Lets breakdown the solving the problem in a set of broad steps.
  2. Everytime the user inputs their step wise solution we should evaluate and see if the step is completed or not. We can never go back to the previous step, once the step is marked as done its done
  3. Once all the steps are solved the problem is considered solved and there's no need to show further hints for it.
  4. Lets start off solving the problem with an initial hint
  5. Students could have different ways of solving the same step so we should still be able to validate and account for that in our system.

  Create a detailed implementation plan for this, first let it have an overview and the second part can have indetailed design and implementaiton details.
  ⎿  Please run /login · API Error: 401 {"type":"error","error":{"type":"authentication_error","message":"Invalid authentication credentials"},"request_id":"req_011CagqQS2HyQvPUNzGx2JkP"}

✻ Baked for 2s

❯ /login
  ⎿  Login interrupted

❯ 1. Lets breakdown the solving the problem in a set of broad steps.
  2. Everytime the user inputs their step wise solution we should evaluate and see if the step is completed or not. We can never go back to the previous step, once the step is marked as done its done
  3. Once all the steps are solved the problem is considered solved and there's no need to show further hints for it.
  4. Lets start off solving the problem with an initial hint
  5. Students could have different ways of solving the same step so we should still be able to validate and account for that in our system.

  Create a detailed implementation plan for this, first let it have an overview and the second part can have indetailed design and implementaiton details.

  Read 2 files, listed 3 directories (ctrl+o to expand)

⏺ Step-Locked Solving — Implementation Plan

  Part 1 — Overview

  Mental model. A problem is a fixed ordered sequence of broad steps (already modeled as canonicalSteps). The session has a currentStepIndex pointer that only moves forward. Every student submission is evaluated
  against the current target step, not the full problem. Once that step is satisfied, the pointer advances and the prior step becomes immutable. When the pointer passes the last step, the problem is solved and the
  hint UI is replaced with a completion state.

  Five behaviors mapped to the system

  ┌──────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │                     Requirement                      │                                                                       Mechanism                                                                        │
  ├──────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 1. Break problem into broad steps                    │ Use existing Problem.canonicalSteps[]; this is the spine of the session.                                                                               │
  ├──────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 2. Evaluate each input against current step; lock on │ New session reducer with currentStepIndex; /api/validate is called with the target canonical step and returns advances: boolean.                       │
  │  completion                                          │                                                                                                                                                        │
  ├──────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 3. Solved = all steps done, no more hints            │ When currentStepIndex === canonicalSteps.length, UI hides input and hint button; /api/hint short-circuits.                                             │
  ├──────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 4. Initial hint before any input                     │ New /api/hint mode kind: "initial" fired on session start for step 0.                                                                                  │
  ├──────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 5. Multiple valid solution paths per step            │ Each canonical step carries acceptableForms[] + SymPy equivalence check via trigsimp(target - student) == 0; also allow "skip-ahead" matching against  │
  │                                                      │ later steps' forms (configurable).                                                                                                                     │
  └──────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  What changes vs. today. Today validation is global ("did this advance the proof toward the final answer?"). We're narrowing it to: "does this satisfy step k?" That gives deterministic locking and a clean place to
   render per-step state. SymPy stays the judge; Claude stays the teacher.

  What stays the same. Types, KaTeX/MathLive UI, Mathpix/Gemini OCR confirmation flow, rate limiting, prompt locking rule.

  ---
  Part 2 — Detailed Design

  2.1 Type changes (lib/types.ts)

  export type StepStatus = 'pending' | 'active' | 'completed'

  export type SessionStep = {
    canonicalIndex: number          // which CanonicalStep this corresponds to
    status: StepStatus
    attempts: Step[]                // every submission against this step (locked when completed)
    completedAt: number | null
  }

  export type SolveSession = {
    problemId: string
    sessionSteps: SessionStep[]     // length === problem.canonicalSteps.length
    currentStepIndex: number        // 0..canonicalSteps.length (== length means solved)
    solved: boolean
    startedAt: number
    apiCallCount: number
    initialHintShown: boolean
  }

  Step keeps its current shape; we just bucket attempts under the canonical step they targeted.

  2.2 Session state machine (hooks/useSolveSession.ts)

  States: loading → awaiting_initial_hint → active(step k) → validating → showing_feedback → active(step k|k+1) → … → solved.

  Transitions:
  - START → fetch initial hint for step 0 → enter active(0).
  - SUBMIT(latex) → call /api/validate with targetStep = canonicalSteps[currentStepIndex].
  - On correct: append to sessionSteps[k].attempts, mark completed, increment currentStepIndex, fetch hint for new active step (if not solved).
  - On incorrect/unparseable: append attempt, stay on step k, fetch corrective Socratic hint.
  - On currentStepIndex === N: set solved = true, stop accepting input.

  Guard: never decrement currentStepIndex. Past SessionStep entries are read-only in the reducer.

  2.3 API: POST /api/validate (revised contract)

  Request adds a target:
  {
    problemId: string
    targetCanonicalStep: CanonicalStep   // the current step only
    previousLatex: string                // expression at end of last completed step (or problem.latex for step 0)
    newStepLatex: string
  }

  Response adds advance signal:
  {
    status: 'correct' | 'incorrect' | 'unparseable'
    advances: boolean                    // true iff step k is now satisfied
    matchedForm: 'expected' | 'acceptable' | 'equivalent' | null
    symbolicForm: string
    reason: string                       // e.g. "sign_error", "wrong_identity", "matches_step_k+1"
  }

  advances=true is the only thing that moves the pointer. The Next.js route is a thin pass-through to the Python service plus rate limiting.

  2.4 Python service: per-step validator (python-service/trig_validator.py)

  def validate_against_step(prev_latex, new_latex, target: CanonicalStep) -> Verdict:
      new_expr = parse_latex_safe(new_latex)
      if new_expr is None: return Verdict('unparseable', advances=False, reason='parse_failed')

      # 1. Direct symbolic match against the target
      target_expr = parse_latex_safe(target.expectedExpression)
      if equivalent(new_expr, target_expr):
          return Verdict('correct', advances=True, matched='expected')

      # 2. Acceptable alternative forms (handles different solution paths)
      for form in target.acceptableForms:
          if equivalent(new_expr, parse_latex_safe(form)):
              return Verdict('correct', advances=True, matched='acceptable')

      # 3. Valid algebraic transformation of previous line that the canonical
      #    path also produces — accept as a "different but equivalent" route.
      prev_expr = parse_latex_safe(prev_latex)
      if prev_expr is not None and trigsimp(prev_expr - new_expr) == 0:
          # Same expression rewritten — only advance if it matches the target's
          # *value*, otherwise it's equivalent_to_earlier (not progress).
          if equivalent(new_expr, target_expr):
              return Verdict('correct', advances=True, matched='equivalent')
          return Verdict('incorrect', advances=False, reason='restated_previous')

      # 4. Detect skip-ahead (matches a *later* step) — explicitly reject for MVP
      #    but tag so the hint nudges them back to step k.
      return Verdict('incorrect', advances=False, reason=detect_error_pattern(new_expr, target_expr))

  equivalent(a, b) uses simplify(trigsimp(a - b)) == 0, with both expressions normalized via expand_trig first. This is what gives us "different solution paths" support: any LaTeX form that is symbolically equal to
   the target's expected expression — or to one of acceptableForms — counts.

  2.5 API: POST /api/hint — modes

  {
    kind: 'initial' | 'after_step',
    problem: Problem,
    sessionSteps: SessionStep[],
    currentStepIndex: number,
    newAttempt?: Step           // required when kind='after_step'
  }

  - kind='initial' → prompt Claude to produce an opening Socratic question for canonicalSteps[currentStepIndex].conceptTag without referencing student work (none yet).
  - kind='after_step' → existing flow, but the prompt now also receives currentStepIndex, targetStepDescription, and advances. When advances=true, hint celebrates and orients toward the next step; when false, hint
  surfaces misconception inside the current step.

  Short-circuit: if currentStepIndex === sessionSteps.length, return a fixed completion message without calling Claude.

  2.6 Prompt updates (lib/prompts.ts)

  Keep SOCRATIC_HINT_SYSTEM_PROMPT locked. Extend buildHintUserPrompt to inject:
  Current step (k of N): "<target.description>"
  Concept: <target.conceptTag>
  Step advanced: <true|false>
  Already-completed steps:
    1. <desc> ✓
    2. <desc> ✓
  Add an INITIAL_HINT_USER_PROMPT for kind='initial' that asks for a question framing step 0 without revealing the transformation.

  2.7 UI changes (app/solve/[problemId]/page.tsx, components/StepList.tsx)

  - Render a checklist of canonicalSteps with status icons: ✓ completed, ● active, ○ pending. Descriptions visible; expected expressions hidden (would leak the answer).
  - The active row shows the input + the current Socratic hint bubble.
  - Completed rows are collapsed and show the student's accepted attempt rendered via KaTeX. Read-only.
  - When solved=true, replace the input zone with a "Solved — N steps" summary; hide the hint button.
  - Initial hint is fetched on mount (once initialHintShown is false) and stored on the active step.

  2.8 Authoring requirement for problems (data/problems.ts)

  Each CanonicalStep must now carry a meaningful acceptableForms[] covering at least:
  - The expected expression in 2-3 common notations (e.g. 1/√2, √2/2, \sqrt{2}/2).
  - Algebraically distinct but equivalent rewrites (e.g. for "isolate cos²θ": both cos²θ = 1 − sin²θ and 1 − sin²θ = cos²θ).

  For Gemini-generated canonicalSteps (imported problems via /api/generate-steps), update that prompt to also produce acceptableForms[] per step. SymPy equivalence is the safety net for forms not in the list.

  2.9 Rate limiting & edge cases

  - /api/validate: keep 60/session, 200/IP/hr. Add a per-step soft cap (e.g. 10 attempts on the same step) that returns a "take a break / try a different approach" hint without burning Claude tokens.
  - /api/hint: 30/session — initial hint counts as one. Solved state returns cached completion message, no Claude call.
  - Skip-ahead policy: MVP rejects (reason matches_step_k+plus). Document as a future toggle.
  - unparseable → does not advance, does not consume the per-step attempt cap.

  2.10 Build order

  1. Types + reducer (useSolveSession) — no UI yet, unit-test the state machine.
  2. Python validate_against_step + new /api/validate contract.
  3. Hint API kind modes + prompt extension.
  4. UI: per-step checklist, locking, solved state.
  5. Backfill acceptableForms[] for the 10 seed problems.
  6. Update /api/generate-steps prompt to emit acceptableForms[].
  7. End-to-end test: sin(2x)=1 solved with 1/√2 written where canonical expects √2/2 — must accept and advance.

  2.11 Definition of done for this slice

  - A student sees an initial hint before typing.
  - Each submission either advances the active step or stays on it with a corrective hint; never moves backward.
  - Two students taking different valid algebraic paths both reach solved on the same problem.
  - After the final step is accepted, no further hints render and the input is hidden.

  ---
  Want me to start with step 1 (types + useSolveSession reducer with tests), or scaffold the new /api/validate contract first?

✻ Crunched for 1m 23s

※ recap: Goal is a step-locked Socratic trig solver where canonical steps lock as the student completes them. I delivered a two-part implementation plan and am waiting for you to pick the starting slice: types plus
   session reducer, or the new /api/validate contract. (disable recaps in /config)

❯ What if the student imputs a step much further than the current step, it'll have to mark steps correctly

⏺ Good catch — my MVP plan rejected skip-ahead, but the better behavior is to detect and mark all intermediate steps as completed in one go. Here's the revision.

  Skip-ahead detection

  Validator change (Python)

  When the student's expression doesn't match the current target, scan forward through remaining canonical steps before declaring incorrect:

  def validate_against_session(prev_latex, new_latex, current_idx, canonical_steps):
      new_expr = parse_latex_safe(new_latex)
      if new_expr is None:
          return Verdict('unparseable', advance_to=current_idx)

      # Check current step first (fast path)
      if matches_step(new_expr, canonical_steps[current_idx]):
          return Verdict('correct', advance_to=current_idx + 1, skipped=[])

      # Scan forward — find the furthest step this expression satisfies
      for j in range(current_idx + 1, len(canonical_steps)):
          if matches_step(new_expr, canonical_steps[j]):
              # Student jumped from current_idx to j. Validate the leap is sound:
              # new_expr must be derivable from prev_latex (algebraically valid).
              prev_expr = parse_latex_safe(prev_latex)
              if prev_expr is None or not is_valid_transformation(prev_expr, new_expr):
                  return Verdict('incorrect', advance_to=current_idx,
                                 reason='skip_not_derivable')
              return Verdict('correct',
                             advance_to=j + 1,
                             skipped=list(range(current_idx, j)),
                             matched_step=j)

      return Verdict('incorrect', advance_to=current_idx, reason=classify_error(...))

  matches_step reuses the equivalence check from before (expected form + acceptableForms + symbolic equivalence). is_valid_transformation checks that new_expr is symbolically reachable from prev_expr — for trig
  this is mostly trigsimp(prev_expr.subs(...) - new_expr) == 0 against the problem's variables, plus tolerance for substituting known values from earlier steps.

  Validate API contract

  // Response
  {
    status: 'correct' | 'incorrect' | 'unparseable'
    advanceTo: number          // new currentStepIndex (== canonicalSteps.length means solved)
    matchedStep: number | null // which canonical step the input satisfied
    skippedSteps: number[]     // intermediate indices marked completed by inference
    reason: string
  }

  Session reducer

  On correct with skippedSteps = [k, k+1, …, j-1] and matchedStep = j:

  // Mark each skipped step as completed-by-inference
  for (const i of skippedSteps) {
    sessionSteps[i].status = 'completed'
    sessionSteps[i].completedBy = 'inferred'   // new field
    sessionSteps[i].completedAt = now
    // attempts[] stays empty for inferred steps
  }
  // Mark the matched step completed with the actual student attempt
  sessionSteps[matchedStep].status = 'completed'
  sessionSteps[matchedStep].completedBy = 'student'
  sessionSteps[matchedStep].attempts.push(newStep)

  currentStepIndex = advanceTo

  Add to SessionStep:
  completedBy: 'student' | 'inferred' | null

  UI treatment

  Inferred steps render differently in StepList:
  - ✓ with a subtle "(skipped)" or dotted check mark
  - Tooltip: "You jumped past this — we credited it because your next line implied it."
  - The jumped-to step still shows the student's actual LaTeX.

  This keeps the lock invariant (no going back) while giving honest credit.

  Hint behavior on skip-ahead

  /api/hint receives skippedSteps and switches tone: confirm warmly, name the steps that were implicitly used ("Nice — you applied the Pythagorean identity *and* substituted in one move."), then ask the question
  for the new active step. This reinforces the concepts they bypassed without re-teaching.

  Edge: skip-ahead lands on the final answer

  If matchedStep === canonicalSteps.length - 1 and it's the finalAnswer, mark all remaining steps inferred and set solved = true. One-shot solvers shouldn't be punished.

  Edge: invalid leap

  If new_expr matches a future step but isn't algebraically derivable from prev_latex (e.g. they wrote the final answer without doing the work, and it doesn't actually follow from where they were), return incorrect
   with reason: 'skip_not_derivable'. Hint nudges them to show the intermediate reasoning. This protects against students copying an answer they don't understand.

  Edge: matches an earlier completed step

  Already covered by equivalent_to_earlier — return incorrect with reason: 'restated_previous', no advance.

  ---
  This adds one field (completedBy), two response fields (advanceTo, skippedSteps), and the forward-scan loop in the validator. The locking invariant is preserved: the pointer still only moves forward, just
  sometimes by more than one.

  Want me to start coding this, or refine the skip-derivability check first (it's the trickiest piece — too strict and we reject legitimate mental-math leaps; too loose and we credit guesses)?

✻ Baked for 29s

❯ We dont need a UI steplist its just an backend only state machine, we arent making any changes to the app visually

⏺ Got it — steps are backend-only state. The student keeps seeing the same single-input + hint-bubble UI; the step machine just shapes what hint comes back and when the session ends.

  Revised scope

  Remove from the plan
  - StepList.tsx changes, per-step checklist, ✓/●/○ icons, "(skipped)" tooltips.
  - Any visible notion of "current step k of N."
  - completedBy distinction in the UI.

  Keep (all server-side / hook-internal)
  - SessionStep[], currentStepIndex, locking, skip-ahead inference.
  - /api/validate returning advanceTo + skippedSteps.
  - /api/hint receiving step context to shape wording.

  What the user actually sees

  Unchanged: input field, hint bubble, prior attempts rendered as they are today. The only visible behaviors that change:

  1. Initial hint appears on session load (before any input).
  2. Hint wording is better-targeted because the server knows which canonical step is active.
  3. Solved state — when currentStepIndex === N, the input + hint button hide (or show a "Solved" message). This is the one unavoidable visual change, since requirement 3 says no further hints once solved.

  If you want zero visual change, option: leave the input enabled after solved and just have /api/hint return a fixed "You've solved it — nothing more to do here" message. Let me know which you prefer.

  Where the state lives

  - useSolveSession hook holds sessionSteps[] and currentStepIndex in React state — never rendered, only used to build API request payloads.
  - /api/validate is stateless; the hook sends currentStepIndex + canonicalSteps each call.
  - /api/hint is stateless; the hook sends currentStepIndex, skippedSteps from the latest validation, and the new attempt.

  Build order (revised)

  1. Types: extend SolveSession with sessionSteps + currentStepIndex; no UI types.
  2. useSolveSession reducer with locking + skip-ahead application.
  3. Python validate_against_session with forward scan.
  4. /api/validate new contract.
  5. /api/hint kind: 'initial' | 'after_step' + step context in prompt.
  6. Wire initial-hint fetch on mount; wire solved short-circuit.
  7. Backfill acceptableForms[] on seed problems.

  No component file touched except app/solve/[problemId]/page.tsx for the mount-time initial hint and the solved short-circuit — and only if you want the solved state to hide input. Otherwise that file is untouched
   too.

  Want me to start on step 1?
