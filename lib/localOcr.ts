import type { OcrResult } from './types'

/**
 * Local OCR via the Python sidecar service running pix2tex (LaTeX-OCR).
 *
 * The Python service exposes `/ocr` which returns:
 *   { latex, confidence, raw_text, provider: 'pix2tex' | 'unavailable' }
 *
 * If `provider === 'unavailable'`, pix2tex isn't installed in the Python env.
 * The Next.js layer treats that as "no OCR happened" and lets the student
 * type the problem manually on the confirm screen.
 */
export async function runLocalOcr(file: File): Promise<OcrResult> {
  const baseUrl = process.env.PYTHON_SERVICE_URL
  const token = process.env.PYTHON_SERVICE_TOKEN

  if (!baseUrl) {
    return { latex: '', confidence: 0, rawText: '', provider: 'none' }
  }

  const form = new FormData()
  form.append('image', file)

  let res: Response
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, '')}/ocr`, {
      method: 'POST',
      headers: token ? { 'X-Service-Token': token } : undefined,
      body: form
    })
  } catch (err) {
    console.warn('[localOcr] Python service unreachable:', err)
    return { latex: '', confidence: 0, rawText: '', provider: 'none' }
  }

  if (!res.ok) {
    console.warn(`[localOcr] HTTP ${res.status}`)
    return { latex: '', confidence: 0, rawText: '', provider: 'none' }
  }

  const data = (await res.json()) as {
    latex?: string
    confidence?: number
    raw_text?: string
    provider?: string
  }

  if (data.provider !== 'pix2tex') {
    return { latex: '', confidence: 0, rawText: '', provider: 'none' }
  }

  return {
    latex: data.latex ?? '',
    confidence: typeof data.confidence === 'number' ? data.confidence : 0,
    rawText: data.raw_text ?? '',
    provider: 'pix2tex'
  }
}

/**
 * Cheap probe — asks the Python service whether pix2tex is loadable.
 * Returns false on any error (timeout, missing service, missing extras).
 */
export async function isLocalOcrAvailable(): Promise<boolean> {
  const baseUrl = process.env.PYTHON_SERVICE_URL
  if (!baseUrl) return false

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, {
      method: 'GET',
      // Don't hang the OCR route if the service is slow.
      signal: AbortSignal.timeout(1500)
    })
    if (!res.ok) return false
    const data = (await res.json()) as { ocr_available?: boolean }
    return Boolean(data.ocr_available)
  } catch {
    return false
  }
}
