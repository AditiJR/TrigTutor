import type { Problem, Step } from './types'

/**
 * Returns true when the LaTeX looks like a solved final answer: `x = 3`, `θ = 30°`, etc.
 * Used to give Claude an unambiguous signal instead of letting it guess.
 */
export function looksLikeFinalAnswer(latex: string): boolean {
  const s = latex.trim()
  // Matches: <single letter or word> = <pure number / fraction / simple expression with no variables>
  // e.g.  x = 3,  θ = 30,  h = \frac{5}{2},  x = \sqrt{9}
  // Rejects: x^2 = 9,  x = 5^2 - 4^2,  4^2 + x^2 = 5^2
  const finalForm = /^[a-zA-Zα-ωΑ-Ω\\θ]+\s*=\s*[^=+\-*x^]+$/.test(s)
  const hasUnsolvedOps = /[\^]/.test(s.replace(/\\[a-z]+/g, '')) || /[+\-]/.test(s.split('=')[1] ?? '')
  return finalForm && !hasUnsolvedOps
}

export const SOCRATIC_HINT_SYSTEM_PROMPT = `
You are a Socratic tutor for high-school trigonometry and geometry.

Your only job is to write a SHORT forward-looking question (1-2 sentences) based on the verdict already computed by a math engine. You must NEVER decide correctness yourself.

ABSOLUTE RULES — violating any of these is wrong output:
1. NEVER say "finish", "finished", "great finish", "you're done", "that's it", or anything implying the student is complete — UNLESS the field PROBLEM_SOLVED says YES.
2. NEVER reveal the next step, the answer, or any part of the solution.
3. NEVER write a full worked solution.
4. Keep total response under 40 words.
5. Respond ONLY in this exact JSON — no prose outside it:
{
  "socraticHint": "...",
  "encouragement": "...",
  "conceptToReview": "concept_tag or null"
}

HOW TO RESPOND based on the verdict:

verdict = "correct", PROBLEM_SOLVED = NO, step is a MATH expression:
  → Confirm the step was right in one short phrase, then ask ONE question that nudges them toward their next algebraic move without revealing it.
  → Look at all the previous steps — do NOT ask them to do something they already did.
  → Example tone: "Nice rearrangement — what does that simplify to on the right side?"

verdict = "correct", PROBLEM_SOLVED = NO, step is a TEXT ANNOTATION (no math symbols):
  → The student just wrote a label or note, not a new equation.
  → Look at the previous steps. If prior steps already contain the equation, acknowledge the label and ask about the NEXT algebraic move from there — do NOT ask them to write an equation they already wrote.
  → If no prior math steps exist, ask them to now write the equation.

verdict = "correct", PROBLEM_SOLVED = YES:
  → Congratulate them — they've found the answer. Ask them to sanity-check it in context.

verdict = "incorrect":
  → Do NOT say what's right. Ask a question that surfaces the specific error described in REASON.

verdict = "unparseable":
  → Gently ask them to rewrite their step as a math expression.
`.trim()

export const buildHintUserPrompt = (
  problem: Problem,
  allSteps: Step[],
  newStep: Step
): string => {
  const priorSteps = allSteps
    .slice(0, -1)
    .map((s, i) => {
      const status = s.validation?.status ?? 'pending'
      const prevHint = s.hint?.socraticHint ? ` → tutor said: "${s.hint.socraticHint}"` : ''
      return `${i + 1}. ${s.latex} — ${status}${prevHint}`
    })
    .join('\n')

  const stepLatex = newStep.latex
  const isSolved = looksLikeFinalAnswer(stepLatex)
  const isTextAnnotation = !/[\\^_{$]/.test(stepLatex)

  return `
Problem: ${problem.latex}
Topic: ${problem.topic}

Previous steps (with prior tutor responses):
${priorSteps || '(none — this is the first step)'}

Student's new step: ${stepLatex}
Step type: ${isTextAnnotation ? 'TEXT ANNOTATION (no math symbols)' : 'MATH EXPRESSION'}

Verdict: ${newStep.validation?.status ?? 'unknown'}
Reason: ${newStep.validation?.reason ?? 'unknown'}
Concept: ${newStep.validation?.detectedConcept ?? 'unknown'}
PROBLEM_SOLVED: ${isSolved ? 'YES' : 'NO'}
`.trim()
}
