import type { NextRequest } from 'next/server'

/**
 * In-memory rate limiter for MVP. Replace with Redis (or Upstash) before going to prod.
 *
 * Limits per CLAUDE.md:
 *   /api/hint:     30 / session, 100 / IP / hour
 *   /api/validate: 60 / session, 200 / IP / hour
 *   /api/ocr:      not specified — start at 30 / IP / hour to keep Mathpix bills sane
 */

type Bucket = 'hint' | 'validate' | 'ocr'

type Limits = {
  perIpPerHour: number
  perSession?: number
}

const HOUR_MS = 60 * 60 * 1000

const LIMITS: Record<Bucket, Limits> = {
  hint: { perIpPerHour: 100, perSession: 30 },
  validate: { perIpPerHour: 200, perSession: 60 },
  ocr: { perIpPerHour: 30 }
}

type Hits = { count: number; windowStart: number }

const ipBuckets: Record<Bucket, Map<string, Hits>> = {
  hint: new Map(),
  validate: new Map(),
  ocr: new Map()
}

const sessionBuckets: Record<Bucket, Map<string, number>> = {
  hint: new Map(),
  validate: new Map(),
  ocr: new Map()
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterMs: number }

export function checkRateLimit(req: NextRequest, bucket: Bucket): RateLimitResult {
  const sessionId = req.headers.get('x-session-id')?.trim()
  const ip = readClientIp(req)
  const now = Date.now()
  const limits = LIMITS[bucket]
  const map = ipBuckets[bucket]
  const hit = map.get(ip)

  if (!hit || now - hit.windowStart > HOUR_MS) {
    map.set(ip, { count: 1, windowStart: now })
    return { ok: true }
  }

  if (hit.count >= limits.perIpPerHour) {
    return { ok: false, retryAfterMs: HOUR_MS - (now - hit.windowStart) }
  }

  if (sessionId && typeof limits.perSession === 'number') {
    const sessionCount = sessionBuckets[bucket].get(sessionId) ?? 0
    if (sessionCount >= limits.perSession) {
      return { ok: false, retryAfterMs: HOUR_MS }
    }
    sessionBuckets[bucket].set(sessionId, sessionCount + 1)
  }

  hit.count += 1
  return { ok: true }
}

function readClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return req.headers.get('x-real-ip') || 'unknown'
}
