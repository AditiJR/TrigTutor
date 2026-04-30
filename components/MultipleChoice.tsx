'use client'

import { useState } from 'react'
import { InlineMath } from 'react-katex'
import type { Problem } from '@/lib/types'

type Props = {
  problem: Problem
  onPick: (latex: string) => void
  disabled?: boolean
}

/**
 * Optional MCQ scaffolding shown when the student appears stuck.
 * Only renders if the problem includes `multipleChoiceOptions`.
 */
export function MultipleChoice({ problem, onPick, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const options = problem.multipleChoiceOptions ?? []

  if (options.length === 0) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="border border-outline-variant text-secondary hover:bg-surface-container px-3 py-2 rounded-lg font-label text-label flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className="material-symbols-outlined text-[16px]">list</span>
        {open ? 'Hide options' : 'Show options'}
      </button>

      {open && (
        <ul className="absolute bottom-full mb-2 left-0 z-20 w-64 bg-surface border border-border-subtle rounded-lg shadow-lg p-2 flex flex-col gap-1">
          {options.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setOpen(false)
                  onPick(opt)
                }}
                className="w-full text-left px-3 py-2 rounded font-body-sm text-body-sm text-on-surface hover:bg-surface-container transition-colors disabled:opacity-40"
              >
                <InlineMath math={opt} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
