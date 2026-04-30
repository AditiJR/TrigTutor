import type { OcrResult } from './types'

/**
 * Mathpix client. Sends a single image and returns extracted LaTeX + a
 * confidence score.
 *
 * MVP behavior: if credentials aren't set we return an empty result instead of
 * a hardcoded fake. The confirm-ocr page renders that as a low-confidence
 * empty editor where the student types the problem in by hand — much less
 * confusing than getting back an unrelated stub problem.
 */
export async function runMathpixOcr(file: File): Promise<OcrResult> {
  const appId = process.env.MATHPIX_APP_ID
  const appKey = process.env.MATHPIX_APP_KEY

  if (!appId || !appKey) {
    console.warn(
      '[mathpix] No credentials set — returning empty OCR result. The student will type the problem in on the confirm screen.'
    )
    return {
      latex: '',
      confidence: 0,
      rawText: ''
    }
  }

  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mime = file.type || 'image/jpeg'

  const response = await fetch('https://api.mathpix.com/v3/text', {
    method: 'POST',
    headers: {
      app_id: appId,
      app_key: appKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      src: `data:${mime};base64,${base64}`,
      formats: ['latex_simplified', 'text'],
      math_inline_delimiters: ['$', '$']
    })
  })

  if (!response.ok) {
    throw new Error(`Mathpix HTTP ${response.status}`)
  }

  const data = (await response.json()) as {
    latex_simplified?: string
    text?: string
    confidence?: number
  }

  return {
    latex: data.latex_simplified ?? '',
    confidence: typeof data.confidence === 'number' ? data.confidence : 0,
    rawText: data.text ?? ''
  }
}
