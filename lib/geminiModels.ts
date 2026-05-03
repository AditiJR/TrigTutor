/**
 * Gemini model resolution for AI Studio (`GOOGLE_AI_API_KEY` +
 * `@google/generative-ai`). This is **not** Vertex AI billing — buying Google
 * Cloud "Gemini" credits applies to Vertex; keys from aistudio.google.com use
 * the Generative Language API and their own quota list.
 */

const DEFAULT_FALLBACK_IDS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-001',
  'gemini-flash-latest'
] as const

/**
 * Models are tried left-to-right by callers until a non-404 call succeeds.
 *
 * Override with a single id: `GEMINI_MODEL=gemini-2.0-flash-001`
 * Override list: `GEMINI_MODEL_FALLBACK_LIST=gemini-2.0-flash-001,gemini-flash-latest`
 */
export function geminiModelCandidates(): string[] {
  const single = process.env.GEMINI_MODEL?.trim()
  if (single) return [single]

  const csv = process.env.GEMINI_MODEL_FALLBACK_LIST?.trim()
  if (csv) {
    const parts = csv.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length) return parts
  }

  return [...DEFAULT_FALLBACK_IDS]
}

/** HTTP status from @google/generative-ai fetch errors. */
export function geminiHttpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined
  const e = err as Record<string, unknown>
  if (typeof e.status === 'number') return e.status

  const cause = e.cause
  if (cause && typeof cause === 'object' && 'status' in cause) {
    const s = (cause as Record<string, unknown>).status
    if (typeof s === 'number') return s
  }
  return undefined
}
