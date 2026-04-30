import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rateLimit'
import { validateStep } from '@/lib/validator'
import type { ValidationRequest } from '@/lib/types'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(req, 'validate')
  if (!rate.ok) {
    return NextResponse.json({ error: 'rate_limited', retryAfterMs: rate.retryAfterMs }, { status: 429 })
  }

  let body: ValidationRequest
  try {
    body = (await req.json()) as ValidationRequest
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body.problemId || !body.newStepLatex) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  try {
    const result = await validateStep(body)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Validation failed:', err)
    return NextResponse.json({ error: 'validator_unavailable' }, { status: 502 })
  }
}
