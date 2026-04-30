'use client'

import { InlineMath } from 'react-katex'
import type { Step, ValidationStatus } from '@/lib/types'

type Props = {
  steps: Step[]
}

const STATUS_CONFIG: Record<
  ValidationStatus,
  { icon: string; iconFill: boolean; chipClass: string; label: string; mathClass?: string }
> = {
  correct: {
    icon: 'check_circle',
    iconFill: true,
    chipClass: 'bg-correct/10 text-correct border-correct/20',
    label: 'Correct'
  },
  incorrect: {
    icon: 'cancel',
    iconFill: true,
    chipClass: 'bg-error-container/50 text-incorrect border-error-container',
    label: 'Needs another look',
    mathClass: 'line-through decoration-incorrect/50 decoration-2'
  },
  unparseable: {
    icon: 'help',
    iconFill: false,
    chipClass: 'bg-warning/10 text-warning border-warning/20',
    label: 'Try rephrasing'
  },
  equivalent_to_earlier: {
    icon: 'sync',
    iconFill: false,
    chipClass: 'bg-equivalent/10 text-equivalent border-equivalent/20',
    label: 'Same as earlier'
  }
}

export function StepList({ steps }: Props) {
  if (steps.length === 0) {
    return (
      <p className="font-body-sm text-body-sm italic text-secondary px-1">
        No steps yet — write your first step below.
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-stack-md list-none p-0 m-0">
      {steps.map((step, idx) => {
        const status = step.validation?.status
        const config = status ? STATUS_CONFIG[status] : null

        return (
          <li
            key={step.id}
            className="bg-surface border border-border-subtle shadow-sm rounded-lg p-stack-sm flex flex-col gap-stack-sm"
          >
            {/* Header row */}
            <div className="flex justify-between items-center border-b border-border-subtle pb-2">
              <span className="font-label text-label text-outline">Step {idx + 1}</span>
              {config ? (
                <div
                  className={`px-3 py-1 rounded-full flex items-center gap-1 font-label text-label border ${config.chipClass}`}
                >
                  <span
                    className="material-symbols-outlined text-[16px]"
                    style={config.iconFill ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {config.icon}
                  </span>
                  {config.label}
                </div>
              ) : (
                <span className="font-label text-label text-secondary">Pending…</span>
              )}
            </div>

            {/* Math expression */}
            <div
              className={`font-math text-math text-center py-stack-sm text-on-surface ${config?.mathClass ?? ''}`}
            >
              <InlineMath math={step.latex} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}
