'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { OcrConfirmation } from '@/components/OcrConfirmation'
import { saveCustomProblem } from '@/lib/customProblems'
import { clearOcrHandoff, getOcrHandoff, type OcrHandoff } from '@/lib/ocrHandoff'
import type { Problem } from '@/lib/types'

/**
 * Mandatory OCR confirmation. The student lands here after image upload, sees
 * the extracted LaTeX rendered, can edit it, and only then proceeds to a solve
 * session. The actual payload (image + extracted LaTeX) is read from
 * sessionStorage via the small id passed in the URL.
 */
export default function ConfirmOcrPage() {
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
      title: 'Your imported problem',
      latex: confirmedLatex,
      topic: 'solving_equations',
      difficulty: 'practice',
      canonicalSteps: [],
      finalAnswer: ''
    }
    saveCustomProblem(customProblem)
    if (handoff) clearOcrHandoff(handoff.id)
    router.push(`/solve/${id}`)
  }

  if (missing) {
    return (
      <main className="space-y-4">
        <h1 className="text-2xl font-bold">No image to confirm</h1>
        <p className="text-slate-600">
          That upload session expired or the link was opened directly. Head back
          and drop your image again.
        </p>
        <Link href="/" className="text-blue-600 underline">
          Back to start
        </Link>
      </main>
    )
  }

  if (!handoff) {
    return <main className="text-slate-500">Loading…</main>
  }

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Does this look right?</h1>
        <p className="text-slate-600">
          We extracted the problem from your image. Edit it if anything looks
          wrong before we start solving.
        </p>
      </header>
      <OcrConfirmation
        initialLatex={handoff.latex}
        confidence={handoff.confidence}
        imageUrl={handoff.imageDataUrl}
        configured={handoff.configured}
        onConfirm={handleConfirm}
      />
    </main>
  )
}
