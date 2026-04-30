import { NextRequest, NextResponse } from 'next/server'
import { runMathpixOcr } from '@/lib/mathpix'
import { checkRateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'

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

  const configured = Boolean(
    process.env.MATHPIX_APP_ID && process.env.MATHPIX_APP_KEY
  )

  try {
    const result = await runMathpixOcr(file)
    return NextResponse.json({
      latex: result.latex,
      confidence: result.confidence,
      rawText: result.rawText,
      configured,
      needsConfirmation: !configured || result.confidence < 0.85
    })
  } catch (err) {
    console.error('Mathpix OCR failed:', err)
    return NextResponse.json({ error: 'ocr_failed' }, { status: 502 })
  }
}
