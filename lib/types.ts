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
  /** Optional structured diagram facts captured at OCR time. Used by the
   * validator and hint generator when present. */
  diagram?: Diagram | null
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

/** Which OCR backend produced this result. */
export type OcrProvider = 'claude-vision' | 'gemini-vision' | 'mathpix' | 'pix2tex' | 'none'

/** Structured facts extracted from a diagram in the problem image.
 *
 * Used by the validator as ground truth so SymPy can check whether the
 * student's step is consistent with the diagram (e.g. correct side / angle
 * pairing in SOH-CAH-TOA), not just algebraically valid.
 */
export type DiagramShape =
  | 'right_triangle'
  | 'general_triangle'
  | 'unit_circle'
  | 'circle'
  | 'rectangle'
  | 'other'

export type DiagramQuantity = {
  /** "side" or "angle". */
  type: 'side' | 'angle'
  /** Human label as it appears in the figure, e.g. "h", "x", "a", "θ". */
  label: string
  /** Numeric value if labelled in the figure (e.g. 100, 60). null = unknown. */
  value: number | null
  /** "deg" / "rad" for angles, or unit string for sides ("m", "ft", "cm"). */
  unit: string | null
}

export type Diagram = {
  shape: DiagramShape
  given: DiagramQuantity[]
  unknown: DiagramQuantity | null
  /** A LaTeX equation that ties the given quantities to the unknown — what
   * the student should ultimately derive. Optional. */
  impliedRelationLatex: string | null
  /** A 1-2 sentence plain-English description, useful for the hint LLM. */
  description: string
}

export type OcrResult = {
  latex: string
  confidence: number
  rawText: string
  /** Which engine actually ran. "none" means no provider was available and
   * the student must type the problem in manually. */
  provider?: OcrProvider
  /** Structured diagram facts — only populated when the OCR provider is
   * vision-aware (currently Claude Vision). */
  diagram?: Diagram | null
  /** True when extracted text is missing/blank or confidence is very low and
   * the student should review the editor before solving. */
  needsConfirmation?: boolean
  /** @deprecated use `provider !== 'none'` */
  configured?: boolean
}
