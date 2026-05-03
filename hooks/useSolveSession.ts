'use client'

import { useCallback, useMemo, useReducer, useState } from 'react'
import { normalizeStepLatex, splitIntoSteps } from '@/lib/stepParser'
import type {
  HintRequest,
  HintResult,
  InputMethod,
  Problem,
  SolveSession,
  Step,
  ValidationRequest,
  ValidationResult
} from '@/lib/types'

type SubmitArgs = {
  rawInput: string
  latex: string
  inputMethod: InputMethod
}

type Action =
  | { type: 'append_step'; step: Step }
  | { type: 'attach_validation'; stepId: string; validation: ValidationResult }
  | { type: 'attach_hint'; stepId: string; hint: HintResult }
  | { type: 'mark_solved' }
  | { type: 'increment_calls' }

function reducer(state: SolveSession, action: Action): SolveSession {
  switch (action.type) {
    case 'append_step':
      return { ...state, steps: [...state.steps, action.step] }
    case 'attach_validation':
      return {
        ...state,
        steps: state.steps.map((s) =>
          s.id === action.stepId ? { ...s, validation: action.validation } : s
        )
      }
    case 'attach_hint':
      return {
        ...state,
        steps: state.steps.map((s) =>
          s.id === action.stepId ? { ...s, hint: action.hint } : s
        )
      }
    case 'mark_solved':
      return { ...state, solved: true }
    case 'increment_calls':
      return { ...state, apiCallCount: state.apiCallCount + 1 }
  }
}

function initialSession(problem: Problem): SolveSession {
  return {
    problemId: problem.id,
    steps: [],
    solved: false,
    startedAt: Date.now(),
    apiCallCount: 0
  }
}

/**
 * Drives a single solve session. Always validates BEFORE asking for a hint —
 * the LLM must never see a step that hasn't been judged by SymPy.
 */
export function useSolveSession(problem: Problem) {
  const [session, dispatch] = useReducer(reducer, problem, initialSession)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastFeedback, setLastFeedback] = useState<HintResult | null>(null)
  const [loadingHintStepId, setLoadingHintStepId] = useState<string | null>(null)
  const sessionId = useMemo(() => crypto.randomUUID(), [])

  const previousLatex = useMemo(() => {
    if (session.steps.length === 0) return problem.latex
    return session.steps[session.steps.length - 1]?.latex ?? problem.latex
  }, [problem.latex, session.steps])

  const submitStep = useCallback(
    async ({ rawInput, latex, inputMethod }: SubmitArgs) => {
      const parsed = splitIntoSteps(latex)
      const normalizedSteps = parsed.steps.map(normalizeStepLatex).filter(Boolean)
      if (normalizedSteps.length === 0) return

      setIsSubmitting(true)

      try {
        let rollingPrevious = previousLatex
        const draftSteps = [...session.steps]

        for (const [index, normalized] of normalizedSteps.entries()) {
          const step: Step = {
            id: crypto.randomUUID(),
            rawInput: normalizedSteps.length === 1 ? rawInput : `${rawInput} (part ${index + 1})`,
            latex: normalized,
            inputMethod,
            validation: null,
            hint: null,
            timestamp: Date.now()
          }

          draftSteps.push(step)
          dispatch({ type: 'append_step', step })

          // OCR-imported problems have Gemini-generated canonical steps that represent
          // only one possible solution path. Passing them to the validator would reject
          // any approach the student takes that differs from Gemini's guess. Instead,
          // use lenient mode (empty canonical + no final answer) so any parseable
          // expression is accepted and the Socratic hint does the guiding.
          const isOcrProblem = problem.id.startsWith('ocr-')
          const validateBody: ValidationRequest = {
            problemId: problem.id,
            previousLatex: rollingPrevious,
            newStepLatex: normalized,
            expectedFinalAnswer: isOcrProblem ? '' : problem.finalAnswer,
            canonicalSteps: isOcrProblem ? [] : problem.canonicalSteps
          }

          const validation = await postJson<ValidationResult>('/api/validate', validateBody, sessionId)
          dispatch({ type: 'attach_validation', stepId: step.id, validation })

          const stepWithValidation: Step = { ...step, validation }

          setLoadingHintStepId(step.id)
          const hintBody: HintRequest = {
            problem,
            allSteps: [...draftSteps.slice(0, -1), stepWithValidation],
            newStep: stepWithValidation
          }
          let hint: HintResult
          try {
            hint = await postJson<HintResult>('/api/hint', hintBody, sessionId)
          } catch {
            hint = { socraticHint: 'Keep going — what is your next step?', encouragement: '', conceptToReview: null }
          }
          setLoadingHintStepId(null)
          dispatch({ type: 'attach_hint', stepId: step.id, hint })
          setLastFeedback(hint)

          if (
            validation.status === 'correct' &&
            problem.finalAnswer &&
            isFinalAnswer(normalized, problem.finalAnswer)
          ) {
            dispatch({ type: 'mark_solved' })
          }

          rollingPrevious = normalized
        }
      } catch (err) {
        console.error('Step submission failed:', err)
        setLastFeedback({
          socraticHint: 'Something went wrong on our end — try resubmitting in a moment.',
          encouragement: '',
          conceptToReview: null
        })
      } finally {
        setIsSubmitting(false)
      }
    },
    [previousLatex, problem, session.steps, sessionId]
  )

  return { session, submitStep, lastFeedback, isSubmitting, loadingHintStepId }
}

async function postJson<T>(url: string, body: unknown, sessionId: string): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': sessionId
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`)
  return (await res.json()) as T
}

function isFinalAnswer(stepLatex: string, finalAnswer: string): boolean {
  // Cheap heuristic; SymPy is the real source of truth for final-answer detection.
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()
  return norm(stepLatex) === norm(finalAnswer)
}
