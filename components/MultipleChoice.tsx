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
 * Optional MCQ scaffolding. Used as a fallback when the student is stuck.
 * Options come from `problem.multipleChoiceOptions`; if not provided, the button is hidden.
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
        className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Show options
      </button>
      {open && (
        <ul className="absolute z-10 mt-2 w-72 space-y-1 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
          {options.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setOpen(false)
                  onPick(opt)
                }}
                className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-slate-100"
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
