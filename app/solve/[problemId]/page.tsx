'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BlockMath } from 'react-katex'
import { FeedbackBubble } from '@/components/FeedbackBubble'
import { MathInput } from '@/components/MathInput'
import { MultipleChoice } from '@/components/MultipleChoice'
import { StepList } from '@/components/StepList'
import { VoiceInput } from '@/components/VoiceInput'
import { SEED_PROBLEMS } from '@/data/problems'
import { useSolveSession } from '@/hooks/useSolveSession'
import { getCustomProblem } from '@/lib/customProblems'
import type { Problem } from '@/lib/types'

type Props = {
  params: { problemId: string }
}

const DIFFICULTY_LABEL = {
  intro: 'Easy',
  practice: 'Medium',
  challenge: 'Hard'
} as const

const DIFFICULTY_CLASS = {
  intro: 'bg-correct/10 text-correct border-correct/20',
  practice: 'bg-warning/10 text-warning border-warning/20',
  challenge: 'bg-error-container/50 text-incorrect border-error-container'
} as const

export default function SolvePage({ params }: Props) {
  const seedProblem = useMemo(
    () => SEED_PROBLEMS.find((p) => p.id === params.problemId),
    [params.problemId]
  )
  const [customProblem, setCustomProblem] = useState<Problem | null>(null)
  const [checkedCustom, setCheckedCustom] = useState(false)

  useEffect(() => {
    if (seedProblem) {
      setCustomProblem(null)
      setCheckedCustom(true)
      return
    }
    setCustomProblem(getCustomProblem(params.problemId))
    setCheckedCustom(true)
  }, [params.problemId, seedProblem])

  const problem = seedProblem ?? customProblem

  if (!seedProblem && !checkedCustom) {
    return (
      <div className="flex items-center justify-center h-screen gap-3 text-secondary">
        <span className="material-symbols-outlined animate-spin">refresh</span>
        <span className="font-body text-body">Loading problem…</span>
      </div>
    )
  }

  if (!problem) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 text-center px-6">
        <span className="material-symbols-outlined text-5xl text-secondary">
          sentiment_dissatisfied
        </span>
        <h1 className="font-h1 text-h1 text-on-surface">Problem not found</h1>
        <p className="font-body text-body text-secondary max-w-sm">
          This problem may have expired. Choose one from the practice list.
        </p>
        <Link
          href="/"
          className="bg-primary text-on-primary font-label text-label px-6 py-3 rounded-lg shadow-sm hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to problems
        </Link>
      </div>
    )
  }

  return <SolveProblemShell problem={problem} />
}

function SolveProblemShell({ problem }: { problem: Problem }) {
  const { session, submitStep, lastFeedback, isSubmitting } = useSolveSession(problem)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new steps or feedback arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session.steps.length, lastFeedback])

  const topicLabel = problem.topic.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className="flex flex-col h-screen max-w-[1024px] mx-auto bg-background shadow-2xl shadow-surface-variant/30 relative overflow-hidden">
      {/* ── Header ── */}
      <header className="bg-surface border-b border-border-subtle p-stack-md shrink-0 flex flex-col gap-stack-sm z-10">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            aria-label="Go back"
            className="flex items-center justify-center w-touch-target h-touch-target text-secondary hover:bg-surface-container rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>

          <div className="flex items-center gap-stack-sm">
            <span className="font-label text-label text-secondary uppercase tracking-wider">
              {topicLabel}
            </span>
            <span
              className={`px-3 py-1 rounded-full font-label text-label border ${DIFFICULTY_CLASS[problem.difficulty]}`}
            >
              {DIFFICULTY_LABEL[problem.difficulty]}
            </span>
          </div>

          {/* Spacer to balance the back button */}
          <div className="w-touch-target" />
        </div>

        {/* Problem statement */}
        <div className="bg-surface-container-low border border-border-subtle rounded-lg p-stack-md">
          <p className="font-body-sm text-body-sm text-secondary text-center mb-stack-sm">
            {problem.title}
          </p>
          <div className="bg-surface rounded border border-border-subtle shadow-sm mx-auto max-w-fit px-8 py-stack-sm">
            <BlockMath math={problem.latex} />
          </div>
        </div>
      </header>

      {/* ── Scrollable step history ── */}
      <main className="flex-1 overflow-y-auto p-stack-md flex flex-col gap-stack-md scroll-smooth">
        {session.steps.length === 0 && !session.solved && (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-secondary">
            <span className="material-symbols-outlined text-3xl">edit_note</span>
            <p className="font-body-sm text-body-sm italic">
              Write your first step below to begin.
            </p>
          </div>
        )}

        <StepList steps={session.steps} />

        {lastFeedback && <FeedbackBubble feedback={lastFeedback} />}

        {session.solved && (
          <div className="bg-correct/10 border border-correct/20 rounded-lg p-stack-md flex items-center gap-3 text-correct">
            <span
              className="material-symbols-outlined text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              celebration
            </span>
            <div>
              <p className="font-body font-semibold">Great work — problem complete!</p>
              <p className="font-body-sm text-body-sm text-correct/80">
                You worked through every step correctly.
              </p>
            </div>
          </div>
        )}


        {/* Scroll anchor */}
        <div ref={bottomRef} className="h-4" />
      </main>

      {/* ── Input footer ── */}
      {!session.solved && (
        <footer className="bg-surface border-t border-border-subtle p-stack-md flex flex-col gap-stack-sm shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.03)] shrink-0 z-10">
          <MathInput
            onSubmit={(latex) =>
              submitStep({ rawInput: latex, latex, inputMethod: 'keyboard' })
            }
            disabled={isSubmitting}
            placeholder="Type your next step…"
            voiceSlot={
              <VoiceInput
                onResult={(latex, raw) =>
                  submitStep({ rawInput: raw, latex, inputMethod: 'voice' })
                }
                disabled={isSubmitting}
              />
            }
          />

          {/* Optional MCQ (only shows if problem has options) */}
          <div className="flex justify-center pt-1">
            <MultipleChoice
              problem={problem}
              onPick={(latex) =>
                submitStep({ rawInput: latex, latex, inputMethod: 'mcq' })
              }
              disabled={isSubmitting}
            />
          </div>
        </footer>
      )}

      {session.solved && (
        <footer className="bg-surface border-t border-border-subtle p-stack-md shrink-0 z-10 flex justify-center">
          <Link
            href="/"
            className="bg-primary text-on-primary font-label text-label px-8 py-3 rounded-lg shadow-sm hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">home</span>
            Back to practice
          </Link>
        </footer>
      )}
    </div>
  )
}
