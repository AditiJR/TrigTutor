import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { CanonicalStep, TrigConcept } from '@/lib/types'

export const runtime = 'nodejs'

const MODEL = 'gemini-2.5-flash'

/**
 * POST /api/generate-steps
 *
 * Given a trig problem (LaTeX + optional diagram description), asks Gemini to
 * produce a reference solution as CanonicalStep[]. These steps are stored with
 * the custom problem so SymPy has a concrete path to validate student work
 * against — replacing the "no canonical steps, accept everything" lenient mode.
 *
 * The LLM here is generating the reference solution, NOT judging correctness.
 * SymPy remains the sole correctness judge.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'no_ai_provider' }, { status: 503 })
  }

  let body: { latex?: string; diagramDescription?: string; topic?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { latex, diagramDescription, topic } = body
  if (!latex?.trim()) {
    return NextResponse.json({ error: 'latex_required' }, { status: 400 })
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: MODEL })

  const prompt = buildPrompt(latex, diagramDescription, topic)

  let responseText = ''
  const MAX_RETRIES = 3
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt)
      responseText = result.response.text()
      break
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 429 && attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 15000))
        continue
      }
      console.error('[generate-steps] Gemini error:', err)
      return NextResponse.json({ error: 'ai_failed' }, { status: 502 })
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(extractJson(responseText))
  } catch {
    console.error('[generate-steps] JSON parse failed:', responseText)
    return NextResponse.json({ error: 'parse_failed' }, { status: 502 })
  }

  const { steps, finalAnswer } = normalizeResponse(parsed)

  if (steps.length === 0) {
    return NextResponse.json({ error: 'no_steps_returned' }, { status: 502 })
  }

  return NextResponse.json({ steps, finalAnswer })
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────────────────────────────────────

function buildPrompt(
  latex: string,
  diagramDescription?: string,
  topic?: string
): string {
  const diagramCtx = diagramDescription
    ? `\nDiagram context: ${diagramDescription}`
    : ''
  const topicCtx = topic ? `\nTopic: ${topic}` : ''

  return `You are a math teacher creating a step-by-step solution for a high-school trigonometry problem.

Problem: ${latex}${diagramCtx}${topicCtx}

Solve this problem completely. For each step, write the mathematical expression that results from that step.

Return ONLY a JSON object in this exact format:
{
  "finalAnswer": "<LaTeX of the final numeric or symbolic answer>",
  "steps": [
    {
      "index": 0,
      "description": "Set up the trig ratio",
      "expectedExpression": "<LaTeX expression after this step>",
      "conceptTag": "<one of: sohcahtoa, pythagorean_identity, special_angles, unit_circle, inverse_trig, algebra>",
      "acceptableForms": ["<alternative valid LaTeX forms for the same value>"]
    }
  ]
}

Rules:
- Each expectedExpression must be a LaTeX equation or expression (e.g. "\\tan(18^\\circ) = \\frac{h}{100}")
- acceptableForms should list 1-3 equivalent forms a student might write
- conceptTag must be exactly one of: sohcahtoa, pythagorean_identity, special_angles, unit_circle, inverse_trig, algebra
- Keep steps at a level appropriate for a high-school student (3-6 steps total)
- Do NOT include prose — only valid JSON
- finalAnswer should be just the value (e.g. "32.5" or "\\frac{\\sqrt{3}}{2}")
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Response normalisation
// ─────────────────────────────────────────────────────────────────────────────

type RawStep = {
  index?: unknown
  description?: unknown
  expectedExpression?: unknown
  conceptTag?: unknown
  acceptableForms?: unknown
}

function normalizeResponse(raw: unknown): {
  steps: CanonicalStep[]
  finalAnswer: string
} {
  if (!raw || typeof raw !== 'object') return { steps: [], finalAnswer: '' }
  const r = raw as Record<string, unknown>

  const finalAnswer = typeof r.finalAnswer === 'string' ? r.finalAnswer.trim() : ''
  const rawSteps = Array.isArray(r.steps) ? r.steps : []

  const steps: CanonicalStep[] = rawSteps
    .map((s: unknown, i: number): CanonicalStep | null => {
      if (!s || typeof s !== 'object') return null
      const step = s as RawStep

      const expectedExpression =
        typeof step.expectedExpression === 'string' && step.expectedExpression.trim()
          ? step.expectedExpression.trim()
          : null
      if (!expectedExpression) return null

      const description =
        typeof step.description === 'string' ? step.description.trim() : `Step ${i + 1}`

      const conceptTag = normalizeConceptTag(step.conceptTag)

      const acceptableForms = Array.isArray(step.acceptableForms)
        ? (step.acceptableForms as unknown[])
            .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
        : []

      return {
        index: typeof step.index === 'number' ? step.index : i,
        description,
        expectedExpression,
        conceptTag,
        acceptableForms
      }
    })
    .filter((s): s is CanonicalStep => s !== null)

  return { steps, finalAnswer }
}

const VALID_CONCEPTS: TrigConcept[] = [
  'sohcahtoa',
  'pythagorean_identity',
  'special_angles',
  'unit_circle',
  'inverse_trig',
  'algebra'
]

function normalizeConceptTag(raw: unknown): TrigConcept {
  if (typeof raw === 'string' && VALID_CONCEPTS.includes(raw as TrigConcept)) {
    return raw as TrigConcept
  }
  return 'algebra'
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return text
  return text.slice(start, end + 1)
}
