'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { normalizeStepLatex, splitIntoSteps } from '@/lib/stepParser'
import type {
  HintRequest,
  HintResult,
  InputMethod,
  Problem,
  SessionStep,
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
  | {
      type: 'apply_advance'
      stepId: string                  // student attempt that triggered this
      advanceTo: number
      skippedSteps: number[]
      matchedCanonicalStep: number | null
      now: number
    }
  | { type: 'mark_solved' }
  | { type: 'mark_initial_hint_shown' }
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
    case 'apply_advance': {
      // Locking invariant: never decrement currentStepIndex.
      if (action.advanceTo <= state.currentStepIndex) return state

      const studentStep = state.steps.find((s) => s.id === action.stepId) ?? null
      const targetIndex =
        action.matchedCanonicalStep !== null &&
        action.matchedCanonicalStep >= state.currentStepIndex &&
        action.matchedCanonicalStep < state.sessionSteps.length
          ? action.matchedCanonicalStep
          : Math.min(action.advanceTo - 1, state.sessionSteps.length - 1)

      const nextSessionSteps = state.sessionSteps.map((ss): SessionStep => {
        if (ss.status === 'completed') return ss
        if (ss.canonicalIndex >= action.advanceTo) return ss

        // Steps in [currentStepIndex, advanceTo) become completed.
        if (ss.canonicalIndex === targetIndex) {
          return {
            ...ss,
            status: 'completed',
            attempts: studentStep ? [...ss.attempts, studentStep] : ss.attempts,
            completedBy: 'student',
            completedAt: action.now
          }
        }
        if (action.skippedSteps.includes(ss.canonicalIndex)) {
          return {
            ...ss,
            status: 'completed',
            completedBy: 'inferred',
            completedAt: action.now
          }
        }
        // Defensive: any other index in the advanced range gets credited too.
        if (
          ss.canonicalIndex >= state.currentStepIndex &&
          ss.canonicalIndex < action.advanceTo &&
          ss.canonicalIndex !== targetIndex
        ) {
          return {
            ...ss,
            status: 'completed',
            completedBy: 'inferred',
            completedAt: action.now
          }
        }
        return ss
      })

      const solved = action.advanceTo >= state.sessionSteps.length
      return {
        ...state,
        sessionSteps: nextSessionSteps,
        currentStepIndex: action.advanceTo,
        solved: solved || state.solved
      }
    }
    case 'mark_solved':
      return { ...state, solved: true }
    case 'mark_initial_hint_shown':
      return { ...state, initialHintShown: true }
    case 'increment_calls':
      return { ...state, apiCallCount: state.apiCallCount + 1 }
  }
}

function initialSession(problem: Problem): SolveSession {
  // Build the backend-only step machine from canonicalSteps. For OCR-imported
  // problems with no canonical steps we use a single placeholder so the pointer
  // logic still works; "solved" then triggers only on final-answer match.
  const sessionSteps: SessionStep[] =
    problem.canonicalSteps.length > 0
      ? problem.canonicalSteps.map((cs) => ({
          canonicalIndex: cs.index,
          description: cs.description,
          conceptTag: cs.conceptTag,
          status: 'pending',
          attempts: [],
          completedBy: null,
          completedAt: null
        }))
      : [
          {
            canonicalIndex: 0,
            description: 'Solve the problem',
            conceptTag: 'exploratory',
            status: 'pending',
            attempts: [],
            completedBy: null,
            completedAt: null
          }
        ]

  return {
    problemId: problem.id,
    steps: [],
    sessionSteps,
    currentStepIndex: 0,
    solved: false,
    startedAt: Date.now(),
    apiCallCount: 0,
    initialHintShown: false
  }
}

/**
 * Drives a single solve session. Always validates BEFORE asking for a hint —
 * the LLM must never see a step that hasn't been judged by SymPy.
 *
 * State machine: a backend-only `currentStepIndex` walks forward through
 * `sessionSteps`. On every submit:
 *  1. SymPy validates against canonicalSteps[currentStepIndex] and scans forward
 *     for skip-ahead matches.
 *  2. If `advanceTo > currentStepIndex`, those intermediate canonical steps are
 *     marked completed (one as 'student', the rest as 'inferred').
 *  3. When `currentStepIndex === sessionSteps.length`, the problem is solved
 *     and the hint pipeline short-circuits.
 *  4. Locking: the pointer is monotonic — completed steps cannot be re-opened.
 */
export function useSolveSession(problem: Problem) {
  const [session, dispatch] = useReducer(reducer, problem, initialSession)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastFeedback, setLastFeedback] = useState<HintResult | null>(null)
  const [initialHint, setInitialHint] = useState<HintResult | null>(null)
  const [initialHintLoaded, setInitialHintLoaded] = useState(false)
  const [loadingHintStepId, setLoadingHintStepId] = useState<string | null>(null)
  const sessionId = useMemo(() => crypto.randomUUID(), [])
  const problemRef = useRef(problem)
  problemRef.current = problem

  const previousLatex = useMemo(() => {
    if (session.steps.length === 0) return problem.latex
    return session.steps[session.steps.length - 1]?.latex ?? problem.latex
  }, [problem.latex, session.steps])

  // Opening hint before any student input (re-run when problem identity changes).
  useEffect(() => {
    if (session.solved) {
      setInitialHintLoaded(true)
      return
    }
    setInitialHintLoaded(false)
    let cancelled = false

    const body: HintRequest = {
      kind: 'initial',
      problem: problemRef.current,
      allSteps: [],
      newStep: null,
      currentStepIndex: 0,
      skippedSteps: []
    }
    postJson<HintResult>('/api/hint', body, sessionId)
      .then((hint) => {
        if (cancelled) return
        setInitialHint(hint)
        setLastFeedback(hint)
        dispatch({ type: 'mark_initial_hint_shown' })
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Initial hint fetch failed:', err)
      })
      .finally(() => {
        if (!cancelled) setInitialHintLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [problem.id, session.solved, sessionId])

  const submitStep = useCallback(
    async ({ rawInput, latex, inputMethod }: SubmitArgs) => {
      // Solved short-circuit: ignore further submissions once the pointer has
      // walked past the final canonical step.
      if (session.solved) return

      const parsed = splitIntoSteps(latex)
      const normalizedSteps = parsed.steps.map(normalizeStepLatex).filter(Boolean)
      if (normalizedSteps.length === 0) return

      setIsSubmitting(true)

      try {
        let rollingPrevious = previousLatex
        let rollingCurrentStepIndex = session.currentStepIndex
        let rollingSolved: boolean = session.solved
        const draftSteps = [...session.steps]

        for (const [index, normalized] of normalizedSteps.entries()) {
          if (rollingSolved) break

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

          // SymPy uses whatever canonicalSteps / finalAnswer the problem carries
          // (seed data or /api/generate-steps output on confirm-ocr). Empty lists
          // trigger lenient exploratory mode in Python.
          const validateBody: ValidationRequest = {
            problemId: problem.id,
            previousLatex: rollingPrevious,
            newStepLatex: normalized,
            expectedFinalAnswer: problem.finalAnswer ?? '',
            canonicalSteps: problem.canonicalSteps,
            currentStepIndex: rollingCurrentStepIndex
          }

          const validation = await postJson<ValidationResult>('/api/validate', validateBody, sessionId)

          const totalSteps =
            problem.canonicalSteps.length > 0 ? problem.canonicalSteps.length : 1
          const completedNow =
            validation.status === 'correct' && validation.advanceTo >= totalSteps

          dispatch({ type: 'attach_validation', stepId: step.id, validation })

          const stepWithValidation: Step = { ...step, validation }
          draftSteps[draftSteps.length - 1] = stepWithValidation

          // Apply advance from this validation to the local rolling state and
          // the reducer in lockstep.
          if (validation.status === 'correct' && validation.advanceTo > rollingCurrentStepIndex) {
            dispatch({
              type: 'apply_advance',
              stepId: step.id,
              advanceTo: validation.advanceTo,
              skippedSteps: validation.skippedSteps ?? [],
              matchedCanonicalStep: validation.matchedCanonicalStep,
              now: Date.now()
            })
            rollingCurrentStepIndex = validation.advanceTo
          }

          if (completedNow) {
            rollingSolved = true
            dispatch({ type: 'mark_solved' })
          }

          setLoadingHintStepId(step.id)
          const hintBody: HintRequest = {
            kind: 'after_step',
            problem,
            allSteps: [...draftSteps.slice(0, -1), stepWithValidation],
            newStep: stepWithValidation,
            currentStepIndex: rollingCurrentStepIndex,
            skippedSteps: validation.skippedSteps ?? []
          }
          const solvedCopy: HintResult = {
            socraticHint: 'Problem complete — nice work.',
            encouragement: '',
            conceptToReview: null
          }
          let hint: HintResult
          if (rollingSolved) {
            hint = solvedCopy
          } else {
            try {
              hint = await postJson<HintResult>('/api/hint', hintBody, sessionId)
            } catch {
              hint = {
                socraticHint: 'Keep going — what is your next step?',
                encouragement: '',
                conceptToReview: null
              }
            }
          }
          setLoadingHintStepId(null)
          dispatch({ type: 'attach_hint', stepId: step.id, hint })
          setLastFeedback(hint)

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
    [previousLatex, problem, session.steps, session.currentStepIndex, session.solved, sessionId]
  )

  return {
    session,
    submitStep,
    lastFeedback,
    initialHint,
    initialHintLoaded,
    isSubmitting,
    loadingHintStepId
  }
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
