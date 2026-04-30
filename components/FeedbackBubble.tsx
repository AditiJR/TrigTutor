'use client'

import type { HintResult } from '@/lib/types'

type Props = {
  feedback: HintResult
}

export function FeedbackBubble({ feedback }: Props) {
  return (
    <aside className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-600">
        Tutor
      </div>
      <p className="text-base leading-snug text-slate-900">
        {feedback.socraticHint}
      </p>
      {feedback.encouragement && (
        <p className="mt-1 text-sm text-blue-700">{feedback.encouragement}</p>
      )}
      {feedback.conceptToReview && (
        <p className="mt-2 text-xs text-slate-500">
          Concept: {feedback.conceptToReview.replace(/_/g, ' ')}
        </p>
      )}
    </aside>
  )
}
