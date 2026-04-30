import { SEED_PROBLEMS } from '@/data/problems'
import type { ValidationRequest, ValidationResult } from './types'

/**
 * Calls the Python SymPy sidecar. The sidecar is the source of truth for correctness;
 * this client only forwards the request and surfaces errors.
 *
 * If `PYTHON_SERVICE_URL` is unset, we fall back to a permissive stub so the UI can be
 * exercised in dev without the Python service running.
 */
export async function validateStep(
  req: ValidationRequest
): Promise<ValidationResult> {
  const url = process.env.PYTHON_SERVICE_URL
  const token = process.env.PYTHON_SERVICE_TOKEN

  if (!url) {
    throw new Error('PYTHON_SERVICE_URL is not configured')
  }

  const problem = SEED_PROBLEMS.find((p) => p.id === req.problemId)
  const canonicalSteps = req.canonicalSteps ?? problem?.canonicalSteps ?? []

  const response = await fetch(`${url.replace(/\/$/, '')}/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Service-Token': token } : {})
    },
    body: JSON.stringify({
      previous_latex: req.previousLatex,
      new_step_latex: req.newStepLatex,
      expected_final: req.expectedFinalAnswer,
      canonical_steps: canonicalSteps.map((s) => ({
        index: s.index,
        description: s.description,
        expected_expression: s.expectedExpression,
        concept_tag: s.conceptTag,
        acceptable_forms: s.acceptableForms
      }))
    })
  })

  if (!response.ok) {
    throw new Error(`SymPy service HTTP ${response.status}`)
  }

  const data = (await response.json()) as {
    status: ValidationResult['status']
    matched_canonical_step: number | null
    detected_concept: string | null
    symbolic_form: string
    reason: string
  }

  return {
    status: data.status,
    matchedCanonicalStep: data.matched_canonical_step,
    detectedConcept: data.detected_concept,
    symbolicForm: data.symbolic_form,
    reason: data.reason
  }
}
