'use client'

/**
 * Hand-off store for OCR results between the upload page and the confirm page.
 *
 * We can't pass the extracted image / latex via URL params because real photos
 * encoded as data URLs blow past the browser's URL length limit (and Next.js
 * router will silently truncate or fail). Instead we stash the payload in
 * sessionStorage keyed by a short id and only put the id in the URL.
 */

import type { Diagram, OcrProvider, OcrResult } from './types'

const STORAGE_KEY = 'trig-tutor-ocr-handoff'

export type OcrHandoff = {
  id: string
  latex: string
  confidence: number
  rawText: string
  imageDataUrl: string | null
  configured: boolean
  provider: OcrProvider
  diagram: Diagram | null
  createdAt: number
}

type Store = Record<string, OcrHandoff>

export function saveOcrHandoff(
  result: OcrResult,
  imageDataUrl: string | null
): OcrHandoff {
  const id = `ocr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const handoff: OcrHandoff = {
    id,
    latex: result.latex,
    confidence: result.confidence,
    rawText: result.rawText,
    imageDataUrl,
    configured: result.configured ?? true,
    provider: result.provider ?? 'none',
    diagram: result.diagram ?? null,
    createdAt: Date.now()
  }
  const store = readStore()
  store[id] = handoff
  pruneOld(store)
  writeStore(store)
  return handoff
}

export function getOcrHandoff(id: string): OcrHandoff | null {
  const store = readStore()
  return store[id] ?? null
}

export function clearOcrHandoff(id: string): void {
  const store = readStore()
  if (id in store) {
    delete store[id]
    writeStore(store)
  }
}

function readStore(): Store {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Store
  } catch {
    return {}
  }
}

function writeStore(store: Store): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch (err) {
    console.error('[ocrHandoff] Failed to persist:', err)
  }
}

function pruneOld(store: Store): void {
  const cutoff = Date.now() - 60 * 60 * 1000
  for (const [id, entry] of Object.entries(store)) {
    if (entry.createdAt < cutoff) delete store[id]
  }
}
