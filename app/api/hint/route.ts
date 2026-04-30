import { NextRequest, NextResponse } from 'next/server'
import { generateSocraticHint } from '@/lib/claude'
import { checkRateLimit } from '@/lib/rateLimit'
import type { HintRequest } from '@/lib/types'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(req, 'hint')
  if (!rate.ok) {
    return NextResponse.json({ error: 'rate_limited', retryAfterMs: rate.retryAfterMs }, { status: 429 })
  }

  let body: HintRequest
  try {
    body = (await req.json()) as HintRequest
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body.problem || !body.newStep) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  // Critical invariant: validation must already exist on the new step. Claude only
  // generates hints conditioned on a SymPy verdict — never decides correctness itself.
  if (!body.newStep.validation) {
    return NextResponse.json({ error: 'validation_required_before_hint' }, { status: 400 })
  }

  try {
    const result = await generateSocraticHint(body)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Hint generation failed:', err)
    return NextResponse.json({ error: 'hint_unavailable' }, { status: 502 })
  }
}
