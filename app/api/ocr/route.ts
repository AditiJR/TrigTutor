import { NextRequest, NextResponse } from 'next/server'
import { runGeminiVisionOcr } from '@/lib/geminiVision'
import { checkRateLimit } from '@/lib/rateLimit'
import type { OcrProvider, OcrResult } from '@/lib/types'

export const runtime = 'nodejs'

/**
 * OCR endpoint. Uses Gemini Flash Vision (GOOGLE_AI_API_KEY) as the primary
 * provider. Falls back to manual entry if no key is configured.
 *
 * Free tier: 15 req/min, no credit card required.
 * Get a key at https://aistudio.google.com/apikey
 */
export async function POST(req: NextRequest) {
  const rate = checkRateLimit(req, 'ocr')
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfterMs: rate.retryAfterMs },
      { status: 429 }
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'invalid_form_data' }, { status: 400 })
  }

  const file = formData.get('image')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'image_field_required' }, { status: 400 })
  }

  const geminiConfigured = Boolean(process.env.GOOGLE_AI_API_KEY)

  let result: OcrResult | null = null
  const provider: OcrProvider = geminiConfigured ? 'gemini-vision' : 'none'

  if (geminiConfigured) {
    try {
      const gv = await runGeminiVisionOcr(file)
      if (gv.latex.trim() || gv.diagram) {
        result = gv
      }
    } catch (err) {
      console.error('[ocr] Gemini Vision failed:', err)
      return NextResponse.json({ error: 'ocr_failed' }, { status: 502 })
    }
  }

  // No result or no API key → manual entry
  if (!result) {
    return NextResponse.json({
      latex: '',
      confidence: 0,
      rawText: '',
      diagram: null,
      provider: 'none' as OcrProvider,
      configured: geminiConfigured,
      needsConfirmation: true
    })
  }

  return NextResponse.json({
    latex: result.latex,
    confidence: result.confidence,
    rawText: result.rawText,
    diagram: result.diagram ?? null,
    provider,
    configured: geminiConfigured,
    needsConfirmation: result.confidence < 0.85
  })
}
