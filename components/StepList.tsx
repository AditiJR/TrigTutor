'use client'

import { InlineMath } from 'react-katex'
import type { Step, ValidationStatus } from '@/lib/types'

type Props = {
  steps: Step[]
}

const STATUS_STYLES: Record<ValidationStatus, string> = {
  correct: 'border-correct/30 bg-correct/5 text-correct',
  incorrect: 'border-incorrect/30 bg-incorrect/5 text-incorrect',
  unparseable: 'border-unparseable/30 bg-unparseable/5 text-unparseable',
  equivalent_to_earlier: 'border-equivalent/30 bg-equivalent/5 text-equivalent'
}

const STATUS_LABEL: Record<ValidationStatus, string> = {
  correct: 'Correct',
  incorrect: 'Needs another look',
  unparseable: 'Try rephrasing',
  equivalent_to_earlier: 'Same as earlier'
}

export function StepList({ steps }: Props) {
  if (steps.length === 0) {
    return (
      <p className="text-sm italic text-slate-500">
        No steps yet — write your first step below.
      </p>
    )
  }

  return (
    <ol className="space-y-3">
      {steps.map((step, idx) => {
        const status = step.validation?.status
        const styleClass =
          status && STATUS_STYLES[status] ? STATUS_STYLES[status] : 'border-slate-200 bg-white'
        return (
          <li
            key={step.id}
            className={`rounded-lg border p-3 shadow-sm ${styleClass}`}
          >
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold">Step {idx + 1}</span>
              <span>{status ? STATUS_LABEL[status] : 'Pending…'}</span>
            </div>
            <InlineMath math={step.latex} />
          </li>
        )
      })}
    </ol>
  )
}
