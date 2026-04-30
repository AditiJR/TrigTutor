import Anthropic from '@anthropic-ai/sdk'
import type {
  Diagram,
  DiagramQuantity,
  DiagramShape,
  OcrResult
} from './types'

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
 * Extract LaTeX + structured diagram facts from a trig problem image.
 *
 * IMPORTANT: this function is PERCEPTION ONLY. It must never solve, simplify,
 * or evaluate the problem. The strict system prompt + JSON schema enforce
 * that. SymPy remains the sole judge of correctness.
 */
export async function runClaudeVisionOcr(file: File): Promise<OcrResult> {
  const client = getClient()
  if (!client) {
    return { latex: '', confidence: 0, rawText: '', provider: 'none' }
  }

  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mediaType = inferMediaType(file)

  let response
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: VISION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64
              }
            },
            { type: 'text', text: VISION_USER_PROMPT }
          ]
        }
      ]
    })
  } catch (err) {
    console.error('[claudeVision] API error:', err)
    return { latex: '', confidence: 0, rawText: '', provider: 'none' }
  }

  const textBlock = response.content.find((c) => c.type === 'text')
  const text = textBlock && textBlock.type === 'text' ? textBlock.text : ''

  if (!text.trim()) {
    return { latex: '', confidence: 0, rawText: '', provider: 'none' }
  }

  let parsed: VisionResponseShape | null = null
  try {
    parsed = JSON.parse(extractJson(text)) as VisionResponseShape
  } catch (err) {
    console.error('[claudeVision] Failed to parse JSON:', err, text)
    return { latex: '', confidence: 0, rawText: text, provider: 'none' }
  }

  const latex = String(parsed?.latex ?? '').trim()
  const diagram = normalizeDiagram(parsed?.diagram)

  if (!latex && !diagram) {
    return { latex: '', confidence: 0, rawText: text, provider: 'none' }
  }

  return {
    latex,
    confidence: latex ? 0.92 : 0.5,
    rawText: text,
    provider: 'claude-vision',
    diagram
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Prompts
// ──────────────────────────────────────────────────────────────────────────

const VISION_SYSTEM_PROMPT = `
You are a vision-only diagram parser for a high-school trigonometry tutor.

Your ONLY job is to look at an image and extract:
  1. The LaTeX text of the problem statement / equations.
  2. A structured description of any geometric diagram in the image.

You must NEVER:
  - solve the problem
  - simplify expressions
  - evaluate trig functions
  - compute the answer
  - explain anything

You must ALWAYS:
  - return a single valid JSON object matching the schema below
  - keep all extracted LaTeX exactly as it appears (do not "fix" or simplify)
  - leave fields null when the information is not visible

JSON schema:
{
  "latex": string  // LaTeX of the problem text/equations as written
                   // (e.g. "Find $h$ in $\\\\tan(60°) = h/12$")
                   // Use $...$ for inline math. Empty string if not present.
  "diagram": {     // null if there is no geometric diagram
    "shape": "right_triangle" | "general_triangle" | "unit_circle"
           | "circle" | "rectangle" | "other"
    "given": [
      {
        "type": "side" | "angle",
        "label": string,        // letter shown in figure, e.g. "h", "x", "θ"
        "value": number | null, // numeric value if labelled, else null
        "unit": string | null   // "deg", "rad", "m", "ft", "cm", or null
      }
    ],
    "unknown": {                // the quantity the student is solving for
      "type": "side" | "angle",
      "label": string,
      "value": null,
      "unit": string | null
    } | null,
    "impliedRelationLatex": string | null,
        // a single LaTeX equation that ties given quantities to the unknown
        // (e.g. "\\\\tan(60^\\\\circ) = \\\\frac{h}{12}")
        // null if unclear
    "description": string  // 1-2 sentence plain English summary of the figure
  } | null
}

Return ONLY the JSON object — no prose before or after.
`.trim()

const VISION_USER_PROMPT =
  'Extract the LaTeX and diagram structure from this image. Return strict JSON.'

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

type VisionResponseShape = {
  latex?: unknown
  diagram?: unknown
}

function extractJson(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return text
  return text.slice(start, end + 1)
}

function inferMediaType(
  file: File
): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const t = (file.type || '').toLowerCase()
  if (t.includes('png')) return 'image/png'
  if (t.includes('gif')) return 'image/gif'
  if (t.includes('webp')) return 'image/webp'
  return 'image/jpeg'
}

function normalizeDiagram(raw: unknown): Diagram | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const shape = normalizeShape(r.shape)
  const given = normalizeQuantities(r.given)
  const unknown = normalizeQuantity(r.unknown)
  const impliedRelationLatex =
    typeof r.impliedRelationLatex === 'string' && r.impliedRelationLatex.trim()
      ? r.impliedRelationLatex
      : null
  const description =
    typeof r.description === 'string' ? r.description.slice(0, 400) : ''

  return {
    shape,
    given,
    unknown,
    impliedRelationLatex,
    description
  }
}

function normalizeShape(s: unknown): DiagramShape {
  const allowed: DiagramShape[] = [
    'right_triangle',
    'general_triangle',
    'unit_circle',
    'circle',
    'rectangle',
    'other'
  ]
  if (typeof s === 'string' && (allowed as string[]).includes(s)) {
    return s as DiagramShape
  }
  return 'other'
}

function normalizeQuantities(q: unknown): DiagramQuantity[] {
  if (!Array.isArray(q)) return []
  return q
    .map((item) => normalizeQuantity(item))
    .filter((x): x is DiagramQuantity => x !== null)
}

function normalizeQuantity(q: unknown): DiagramQuantity | null {
  if (!q || typeof q !== 'object') return null
  const r = q as Record<string, unknown>
  const type = r.type === 'angle' ? 'angle' : r.type === 'side' ? 'side' : null
  if (!type) return null

  const label = typeof r.label === 'string' ? r.label : ''
  const value = typeof r.value === 'number' && Number.isFinite(r.value) ? r.value : null
  const unit = typeof r.unit === 'string' ? r.unit : null

  return { type, label, value, unit }
}
