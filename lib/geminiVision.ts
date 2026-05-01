import {
  GoogleGenerativeAI,
  type GenerativeModel
} from '@google/generative-ai'
import type {
  Diagram,
  DiagramQuantity,
  DiagramShape,
  OcrResult
} from './types'

const MODEL = 'gemini-2.5-flash'

let cachedModel: GenerativeModel | null = null

function getModel(): GenerativeModel | null {
  if (!process.env.GOOGLE_AI_API_KEY) return null
  if (!cachedModel) {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
    cachedModel = genAI.getGenerativeModel({ model: MODEL })
  }
  return cachedModel
}

/**
 * Extract LaTeX + structured diagram facts from a trig problem image.
 * Uses Gemini Flash Vision — free tier at 15 req/min.
 *
 * IMPORTANT: perception only — never solves or evaluates.
 */
export async function runGeminiVisionOcr(file: File): Promise<OcrResult> {
  const model = getModel()
  if (!model) {
    return { latex: '', confidence: 0, rawText: '', provider: 'none' }
  }

  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mimeType = inferMimeType(file)

  let responseText = ''
  const MAX_RETRIES = 3
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent([
        VISION_SYSTEM_PROMPT,
        { inlineData: { data: base64, mimeType } },
        VISION_USER_PROMPT
      ])
      responseText = result.response.text()
      break
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 429 && attempt < MAX_RETRIES - 1) {
        const waitMs = (attempt + 1) * 15000 // 15s, 30s
        console.warn(`[geminiVision] Rate limited, retrying in ${waitMs / 1000}s...`)
        await new Promise((r) => setTimeout(r, waitMs))
        continue
      }
      console.error('[geminiVision] API error:', err)
      throw err
    }
  }

  if (!responseText.trim()) {
    return { latex: '', confidence: 0, rawText: '', provider: 'none' }
  }

  let parsed: VisionResponseShape | null = null
  try {
    parsed = JSON.parse(extractJson(responseText)) as VisionResponseShape
  } catch (err) {
    console.error('[geminiVision] Failed to parse JSON:', err, responseText)
    return { latex: '', confidence: 0, rawText: responseText, provider: 'none' }
  }

  const latex = String(parsed?.latex ?? '').trim()
  const diagram = normalizeDiagram(parsed?.diagram)

  if (!latex && !diagram) {
    return { latex: '', confidence: 0, rawText: responseText, provider: 'none' }
  }

  return {
    latex,
    confidence: latex ? 0.92 : 0.5,
    rawText: responseText,
    provider: 'gemini-vision',
    diagram
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Prompts — identical contract to claudeVision.ts
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
  // Strip markdown code fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return text
  return text.slice(start, end + 1)
}

function inferMimeType(file: File): string {
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

  return { shape, given, unknown, impliedRelationLatex, description }
}

function normalizeShape(s: unknown): DiagramShape {
  const allowed: DiagramShape[] = [
    'right_triangle', 'general_triangle', 'unit_circle',
    'circle', 'rectangle', 'other'
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
