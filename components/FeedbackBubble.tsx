'use client'

import type { HintResult } from '@/lib/types'

type Props = {
  feedback: HintResult
}

export function FeedbackBubble({ feedback }: Props) {
  return (
    <div className="bg-surface-bright border border-border-subtle border-l-4 border-l-primary-container shadow-sm rounded-r-lg rounded-l-sm p-stack-md flex flex-col gap-stack-sm ml-2 relative">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1 text-primary-container">
        <span
          className="material-symbols-outlined"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          school
        </span>
        <span className="font-label text-label">Tutor Hint</span>
      </div>

      {/* Hint */}
      <p className="font-body text-body text-on-surface">{feedback.socraticHint}</p>

      {/* Encouragement */}
      {feedback.encouragement && (
        <p className="font-body-sm text-body-sm text-secondary italic mt-1">
          {feedback.encouragement}
        </p>
      )}

      {/* Concept chip */}
      {feedback.conceptToReview && (
        <div className="mt-2">
          <span className="bg-surface-container text-on-surface-variant px-3 py-1.5 rounded-full font-label text-label border border-border-subtle inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">local_library</span>
            {feedback.conceptToReview.replace(/_/g, ' ')}
          </span>
        </div>
      )}
    </div>
  )
}
