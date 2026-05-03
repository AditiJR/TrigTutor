import { NextRequest, NextResponse } from 'next/server'
import { runGeminiVisionOcr } from '@/lib/geminiVision'
import { checkRateLimit } from '@/lib/rateLimit'
import type { OcrProvider, OcrResult } from '@/lib/types'

export const runtime = 'nodejs'

/**
 * OCR endpoint — Gemini Flash Vision for all modes.
 *
 * ?mode=step  skips diagram extraction (handwritten answer steps)
 * default     full extraction including diagram structure (problem capture)
 *
 * Free tier: 15 req/min. Get a key at https://aistudio.google.com/apikey
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

  const isStepMode = new URL(req.url).searchParams.get('mode') === 'step'
  const geminiConfigured = Boolean(process.env.GOOGLE_AI_API_KEY)

  if (!geminiConfigured) {
    return NextResponse.json({
      latex: '',
      confidence: 0,
      rawText: '',
      diagram: null,
      provider: 'none' as OcrProvider,
      configured: false,
      needsConfirmation: true
    })
  }

  let result: OcrResult
  try {
    result = await runGeminiVisionOcr(file)
  } catch (err) {
    console.error('[ocr] Gemini Vision failed:', err)
    return NextResponse.json({ error: 'ocr_failed' }, { status: 502 })
  }

  return NextResponse.json({
    latex: result.latex,
    confidence: result.confidence,
    rawText: result.rawText,
    diagram: isStepMode ? null : (result.diagram ?? null),
    provider: result.provider,
    configured: true,
    needsConfirmation: result.confidence < 0.85
  })
}
