'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { OcrConfirmation } from '@/components/OcrConfirmation'
import { saveCustomProblem } from '@/lib/customProblems'
import { clearOcrHandoff, getOcrHandoff, type OcrHandoff } from '@/lib/ocrHandoff'
import type { Problem } from '@/lib/types'

/**
 * Mandatory OCR confirmation. The student lands here after image upload, sees
 * the extracted LaTeX rendered, can edit it, and only then proceeds to a solve
 * session.
 */
export default function ConfirmOcrPage() {
  return (
    <div className="min-h-screen flex flex-col bg-bg-base">
      {/* Minimal transactional header */}
      <header className="bg-surface border-b border-border-subtle h-16 flex items-center px-gutter shrink-0 sticky top-0 z-50">
        <div className="max-w-[1024px] mx-auto w-full flex items-center gap-stack-md">
          <BackButton />
          <h1 className="font-h2 text-h2 text-on-surface">Confirm Math Problem</h1>
        </div>
      </header>

      {/* Content — wrapped in Suspense because useSearchParams needs it */}
      <main className="flex-grow w-full max-w-[1024px] mx-auto px-gutter py-stack-lg flex flex-col gap-stack-lg">
        <Suspense
          fallback={
            <div className="flex items-center justify-center pt-16 gap-3 text-secondary">
              <span className="material-symbols-outlined animate-spin">refresh</span>
              <span className="font-body text-body">Loading…</span>
            </div>
          }
        >
          <ConfirmOcrContent />
        </Suspense>
      </main>
    </div>
  )
}

function BackButton() {
  const router = useRouter()
  return (
    <button
      onClick={() => router.back()}
      aria-label="Go back"
      className="w-touch-target h-touch-target flex items-center justify-center rounded-full hover:bg-surface-container-low text-secondary transition-colors"
    >
      <span className="material-symbols-outlined text-[20px]">arrow_back</span>
    </button>
  )
}

function ConfirmOcrContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [handoff, setHandoff] = useState<OcrHandoff | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) {
      setMissing(true)
      return
    }
    const found = getOcrHandoff(id)
    if (!found) {
      setMissing(true)
      return
    }
    setHandoff(found)
  }, [searchParams])

  const handleConfirm = (confirmedLatex: string) => {
    const id = `ocr-${Date.now().toString(36)}`
    const customProblem: Problem = {
      id,
      title: handoff?.diagram?.description?.slice(0, 80) || 'Your imported problem',
      latex: confirmedLatex,
      topic: 'solving_equations',
      difficulty: 'practice',
      canonicalSteps: [],
      finalAnswer: '',
      diagram: handoff?.diagram ?? null
    }
    saveCustomProblem(customProblem)
    if (handoff) clearOcrHandoff(handoff.id)
    router.push(`/solve/${id}`)
  }

  if (missing) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 pt-16 text-center">
        <span className="material-symbols-outlined text-5xl text-secondary">
          image_not_supported
        </span>
        <h2 className="font-h2 text-h2 text-on-surface">No image to confirm</h2>
        <p className="font-body text-body text-secondary max-w-sm">
          That upload session expired or the link was opened directly. Head back
          and drop your image again.
        </p>
        <Link
          href="/"
          className="bg-primary text-on-primary font-label text-label px-6 py-3 rounded-lg shadow-sm hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to start
        </Link>
      </div>
    )
  }

  if (!handoff) {
    return (
      <div className="flex items-center justify-center pt-16 gap-3 text-secondary">
        <span className="material-symbols-outlined animate-spin">refresh</span>
        <span className="font-body text-body">Loading…</span>
      </div>
    )
  }

  return (
    <OcrConfirmation
      initialLatex={handoff.latex}
      confidence={handoff.confidence}
      imageUrl={handoff.imageDataUrl}
      configured={handoff.configured}
      provider={handoff.provider}
      diagram={handoff.diagram}
      onConfirm={handleConfirm}
      onCancel={() => router.back()}
    />
  )
}
