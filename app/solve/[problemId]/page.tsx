'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { FeedbackBubble } from '@/components/FeedbackBubble'
import { MathInput } from '@/components/MathInput'
import { MultipleChoice } from '@/components/MultipleChoice'
import { ProblemDisplay } from '@/components/ProblemDisplay'
import { StepList } from '@/components/StepList'
import { VoiceInput } from '@/components/VoiceInput'
import { SEED_PROBLEMS } from '@/data/problems'
import { useSolveSession } from '@/hooks/useSolveSession'
import { getCustomProblem } from '@/lib/customProblems'
import type { Problem } from '@/lib/types'

type Props = {
  params: { problemId: string }
}

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
    return <main className="text-slate-500">Loading problem…</main>
  }
  if (!problem) {
    return (
      <main className="space-y-4">
        <h1 className="text-2xl font-bold">Problem not found</h1>
        <p className="text-slate-600">
          This problem might have expired. Choose one from the practice list.
        </p>
        <Link href="/" className="text-blue-600 underline">
          Back to problems
        </Link>
      </main>
    )
  }

  return <SolveProblemShell problem={problem} />
}

function SolveProblemShell({ problem }: { problem: Problem }) {
  const { session, submitStep, lastFeedback, isSubmitting } = useSolveSession(problem)

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <div className="text-sm uppercase tracking-wide text-slate-500">
          {problem.topic.replace(/_/g, ' ')} · {problem.difficulty}
        </div>
        <h1 className="text-2xl font-bold">{problem.title}</h1>
        <ProblemDisplay latex={problem.latex} block />
      </header>

      <StepList steps={session.steps} />

      {lastFeedback && <FeedbackBubble feedback={lastFeedback} />}

      {!session.solved && (
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Your next step</h2>
          <MathInput onSubmit={(latex) => submitStep({ rawInput: latex, latex, inputMethod: 'keyboard' })} disabled={isSubmitting} />
          <div className="flex flex-wrap gap-2 text-sm">
            <VoiceInput
              onResult={(latex, raw) =>
                submitStep({ rawInput: raw, latex, inputMethod: 'voice' })
              }
              disabled={isSubmitting}
            />
            <MultipleChoice
              problem={problem}
              onPick={(latex) =>
                submitStep({ rawInput: latex, latex, inputMethod: 'mcq' })
              }
              disabled={isSubmitting}
            />
          </div>
        </section>
      )}

      {session.solved && (
        <div className="rounded-lg border border-correct/30 bg-correct/5 p-4 text-correct">
          Nice work — you finished the problem.
        </div>
      )}

      {problem.finalAnswer.length === 0 && (
        <p className="text-xs text-slate-500">
          Imported OCR problems do not yet include canonical solution steps, so this
          session focuses on validating each transformation.
        </p>
      )}
    </main>
  )
}
