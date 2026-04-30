export type TrigTopic =
  | 'unit_circle'
  | 'sin_cos_tan'
  | 'pythagorean_identity'
  | 'special_angles'
  | 'inverse_functions'
  | 'solving_equations'

export type TrigConcept = string

export type Difficulty = 'intro' | 'practice' | 'challenge'

export type CanonicalStep = {
  index: number
  description: string
  expectedExpression: string
  conceptTag: TrigConcept
  acceptableForms: string[]
}

export type Problem = {
  id: string
  title: string
  latex: string
  topic: TrigTopic
  difficulty: Difficulty
  canonicalSteps: CanonicalStep[]
  finalAnswer: string
  multipleChoiceOptions?: string[]
}

export type InputMethod = 'voice' | 'keyboard' | 'ocr' | 'mcq'

export type ValidationStatus =
  | 'correct'
  | 'incorrect'
  | 'unparseable'
  | 'equivalent_to_earlier'

export type ValidationResult = {
  status: ValidationStatus
  matchedCanonicalStep: number | null
  detectedConcept: TrigConcept | null
  symbolicForm: string
  reason: string
}

export type HintResult = {
  socraticHint: string
  encouragement: string
  conceptToReview: TrigConcept | null
}

export type Step = {
  id: string
  rawInput: string
  latex: string
  inputMethod: InputMethod
  validation: ValidationResult | null
  hint: HintResult | null
  timestamp: number
}

export type SolveSession = {
  problemId: string
  steps: Step[]
  solved: boolean
  startedAt: number
  apiCallCount: number
}

export type ValidationRequest = {
  problemId: string
  previousLatex: string
  newStepLatex: string
  expectedFinalAnswer: string
  canonicalSteps?: CanonicalStep[]
}

export type HintRequest = {
  problem: Problem
  allSteps: Step[]
  newStep: Step
}

export type OcrResult = {
  latex: string
  confidence: number
  rawText: string
  /** False when the OCR provider is not configured; the UI then prompts the
   * student to type the problem in by hand. */
  configured?: boolean
  /** True when extracted text is missing/blank or confidence is very low and
   * the student should review the editor before solving. */
  needsConfirmation?: boolean
}
