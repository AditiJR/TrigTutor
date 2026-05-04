'use client'

import type { Step, ValidationStatus } from '@/lib/types'
import { MixedMath } from './MixedMath'

type Props = {
  steps: Step[]
  loadingStepId?: string   // ID of the step currently awaiting its hint
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

export function StepList({ steps, loadingStepId }: Props) {
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
        const hint = step.hint
        const hintLoading = step.id === loadingStepId && !hint

        return (
          <li key={step.id} className="flex flex-col gap-2">
            {/* Step card */}
            <div className="bg-surface border border-border-subtle shadow-sm rounded-lg p-stack-sm flex flex-col gap-stack-sm">
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
                  <span className="font-label text-label text-secondary animate-pulse">Checking…</span>
                )}
              </div>

              {/* Math expression */}
              <div
                className={`font-math text-math text-center py-stack-sm text-on-surface ${config?.mathClass ?? ''}`}
              >
                <MixedMath text={step.latex} />
              </div>
            </div>

            {/* Inline hint — shown below the step card */}
            {hintLoading && (
              <div className="ml-4 bg-surface-bright border border-border-subtle border-l-4 border-l-primary/30 rounded-r-lg rounded-l-sm px-stack-md py-3 flex items-center gap-2 text-secondary">
                <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                <span className="font-body-sm text-body-sm">Tutor is thinking…</span>
              </div>
            )}
            {hint && (
              <div className="ml-4 bg-surface-bright border border-border-subtle border-l-4 border-l-primary rounded-r-lg rounded-l-sm px-stack-md py-stack-sm flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-primary">
                  <span
                    className="material-symbols-outlined text-[16px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    school
                  </span>
                  <span className="font-label text-label">Tutor Hint</span>
                </div>
                <p className="font-body text-body text-on-surface">{hint.socraticHint}</p>
                {hint.encouragement && (
                  <p className="font-body-sm text-body-sm text-secondary italic">{hint.encouragement}</p>
                )}
                {hint.conceptToReview && (
                  <span className="mt-1 bg-surface-container text-on-surface-variant px-3 py-1 rounded-full font-label text-label border border-border-subtle inline-flex items-center gap-1 w-fit">
                    <span className="material-symbols-outlined text-[13px]">local_library</span>
                    {hint.conceptToReview.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
