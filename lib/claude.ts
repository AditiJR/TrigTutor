import Anthropic from '@anthropic-ai/sdk'
import { SOCRATIC_HINT_SYSTEM_PROMPT, buildHintUserPrompt } from './prompts'
import type { HintRequest, HintResult, Problem } from './types'

const MODEL = 'claude-sonnet-4-5'

let cachedClient: Anthropic | null = null

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return cachedClient
}

/**
 * Generates a Socratic hint conditioned on a SymPy verdict that has already been
 * computed. The model is intentionally NOT given any tools to recompute
 * correctness.
 */
export async function generateSocraticHint(
  req: HintRequest
): Promise<HintResult> {
  const client = getClient()
  if (!client) {
    console.warn('[claude] No ANTHROPIC_API_KEY — returning stub hint.')
    return stubHint(req)
  }

  const userPrompt = buildHintUserPrompt(req.problem, req.allSteps, req.newStep)

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    system: SOCRATIC_HINT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }]
  })

  const textBlock = response.content.find((c) => c.type === 'text')
  const text = textBlock && textBlock.type === 'text' ? textBlock.text : ''

  try {
    const parsed = JSON.parse(extractJson(text)) as HintResult
    return {
      socraticHint: String(parsed.socraticHint ?? ''),
      encouragement: String(parsed.encouragement ?? ''),
      conceptToReview: parsed.conceptToReview ?? null
    }
  } catch (err) {
    console.error('[claude] Failed to parse hint JSON:', err, text)
    return stubHint(req)
  }
}

function extractJson(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return text
  return text.slice(start, end + 1)
}

/**
 * Deterministic, problem-aware fallback used when there's no Claude API key.
 * Hints try to be SPECIFIC: they reference the actual angle, ratio, or identity
 * involved so the student gets something more useful than "take another look."
 */
function stubHint(req: HintRequest): HintResult {
  const validation = req.newStep.validation
  const status = validation?.status ?? 'unknown'
  const reason = validation?.reason ?? ''
  const concept = validation?.detectedConcept ?? null
  const isFirstStep = req.allSteps.length <= 1

  if (status === 'correct') {
    return {
      socraticHint: buildCorrectHint(req.problem, concept, isFirstStep),
      encouragement: 'Nice work.',
      conceptToReview: concept
    }
  }
  if (status === 'incorrect') {
    return {
      socraticHint: buildIncorrectHint(req.problem, reason, isFirstStep),
      encouragement: "Almost there — let's check one detail.",
      conceptToReview: concept
    }
  }
  if (status === 'equivalent_to_earlier') {
    return {
      socraticHint:
        'This rewrites a step you already had. What new transformation moves you closer to the answer?',
      encouragement: 'Good thinking.',
      conceptToReview: concept
    }
  }
  // unparseable
  return {
    socraticHint: buildUnparseableHint(req.problem, isFirstStep),
    encouragement: 'No worries — try rephrasing.',
    conceptToReview: concept
  }
}

function buildCorrectHint(
  problem: Problem,
  concept: string | null,
  isFirstStep: boolean
): string {
  if (concept === 'final_answer') {
    return 'You found the answer! Does it make sense in the context of the original problem?'
  }
  if (concept === 'exploratory') {
    return 'Good step. What is the next algebraic move that gets you closer to solving for the unknown?'
  }
  if (problem.topic === 'special_angles') {
    return isFirstStep
      ? 'Right value. Can you say which special triangle (30-60-90 or 45-45-90) it came from?'
      : 'Good. What does that value let you substitute next?'
  }
  if (problem.topic === 'pythagorean_identity') {
    return 'Good use of the Pythagorean identity. What can you substitute or simplify next?'
  }
  if (problem.topic === 'unit_circle') {
    return 'Right — what coordinate did you read off the unit circle, and which one (x or y) is that?'
  }
  if (problem.topic === 'solving_equations') {
    return 'Nice step. What operation gets you closer to isolating the variable?'
  }
  if (problem.topic === 'sin_cos_tan') {
    return 'Good. Which side or ratio do you need to work with next?'
  }
  if (problem.topic === 'inverse_functions') {
    return 'Good — and what acute angle has that ratio?'
  }
  return 'Nice step. What single transformation should come next?'
}

function buildIncorrectHint(
  problem: Problem,
  reason: string,
  isFirstStep: boolean
): string {
  // Specific misconception patterns first.
  if (reason === 'sign_error') {
    return 'Check the sign carefully — which term should be positive or negative here?'
  }
  if (reason === 'swapped_sin_cos') {
    return 'Look at which trig function you used. Is sine or cosine the right one in this position?'
  }
  if (reason === 'missing_exponent') {
    return 'Is that trig term supposed to be squared at this point in the work?'
  }

  // Topic + value-aware fallbacks.
  if (problem.topic === 'special_angles') {
    const angle = detectAngle(problem.latex)
    const fn = detectTrigFn(problem.latex)
    if (angle && fn) {
      return `Think carefully about the value of ${fn}(${angle}). What exact fraction does the special triangle for ${angle} give you?`
    }
    if (angle) {
      return `Think about the special triangle for ${angle}. What exact ratio comes from it?`
    }
    return 'Think about which special triangle this angle comes from. What exact ratio does it give?'
  }
  if (problem.topic === 'pythagorean_identity') {
    return 'Which version of sin²θ + cos²θ = 1 are you using here, and did the substitution preserve both sides?'
  }
  if (problem.topic === 'unit_circle') {
    return 'Which quadrant is this angle in, and what sign should the coordinate have?'
  }
  if (problem.topic === 'solving_equations') {
    return 'What operation did you do to both sides? Did it actually undo the trig function or coefficient on the variable?'
  }
  if (problem.topic === 'sin_cos_tan') {
    return 'Which ratio (SOH, CAH, or TOA) connects the side you have to the side you need? Re-check that pairing.'
  }
  if (problem.topic === 'inverse_functions') {
    return 'You\u2019re looking for the angle whose trig value equals the given ratio. Does the value you wrote produce that ratio?'
  }
  return isFirstStep
    ? 'Take another look at the very first thing the problem asks. What rule or value applies here?'
    : 'Re-check the previous line. What rule or substitution were you applying, and did it preserve the equation?'
}

function buildUnparseableHint(problem: Problem, isFirstStep: boolean): string {
  if (problem.topic === 'special_angles') {
    const angle = detectAngle(problem.latex)
    if (angle) {
      return `Try entering just the value — what fraction does the special triangle give for ${angle}?`
    }
    return 'Try entering just the value as a fraction — no extra words, just the math.'
  }
  if (problem.topic === 'unit_circle') {
    return 'Try entering just the coordinate value as a fraction. Which one does this angle land on?'
  }
  if (problem.topic === 'pythagorean_identity') {
    return 'Try entering just one equation for this step. Which version of the identity applies here?'
  }
  return isFirstStep
    ? 'I had trouble reading that. Could you write just the math for one step (no surrounding text)?'
    : 'I couldn\u2019t parse that line. Try entering just the math for this single step.'
}

function detectAngle(problemLatex: string): string | null {
  const degMatch = problemLatex.match(/(\d{1,3})\^\\?circ/)
  if (degMatch) return `${degMatch[1]}°`
  if (/\\frac\{\\pi\}\{6\}/.test(problemLatex) || /\\tfrac\{\\pi\}\{6\}/.test(problemLatex)) {
    return 'π/6'
  }
  if (/\\frac\{\\pi\}\{4\}/.test(problemLatex) || /\\tfrac\{\\pi\}\{4\}/.test(problemLatex)) {
    return 'π/4'
  }
  if (/\\frac\{\\pi\}\{3\}/.test(problemLatex) || /\\tfrac\{\\pi\}\{3\}/.test(problemLatex)) {
    return 'π/3'
  }
  if (/\\frac\{\\pi\}\{2\}/.test(problemLatex) || /\\tfrac\{\\pi\}\{2\}/.test(problemLatex)) {
    return 'π/2'
  }
  return null
}

function detectTrigFn(problemLatex: string): string | null {
  if (/\\sin/.test(problemLatex)) return 'sin'
  if (/\\cos/.test(problemLatex)) return 'cos'
  if (/\\tan/.test(problemLatex)) return 'tan'
  return null
}
