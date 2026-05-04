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
  /** Original uploaded image as a data URL (OCR flow only). Shown on the solve
   * page so diagrams in photos are not lost after LaTeX extraction. */
  sourceImageDataUrl?: string | null
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
  /** New currentStepIndex after applying this verdict. Equals the request's
   * currentStepIndex when no advance happened. Equals canonicalSteps.length
   * when the problem is solved. */
  advanceTo: number
  /** Canonical step indices that the student bypassed but which we credit as
   * implicitly completed (skip-ahead). Empty for normal step-by-step progress. */
  skippedSteps: number[]
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

export type StepStatus = 'pending' | 'active' | 'completed'
export type StepCompletedBy = 'student' | 'inferred'

/** Backend-only state machine record for a single canonical step. Never rendered. */
export type SessionStep = {
  canonicalIndex: number
  description: string
  conceptTag: TrigConcept
  status: StepStatus
  /** Student attempts that targeted this step. Empty for inferred completions. */
  attempts: Step[]
  completedBy: StepCompletedBy | null
  completedAt: number | null
}

export type SolveSession = {
  problemId: string
  steps: Step[]
  /** Backend-only: per-canonical-step state. Drives locking and skip-ahead. */
  sessionSteps: SessionStep[]
  /** Pointer into sessionSteps. Monotonically non-decreasing. When equal to
   * sessionSteps.length, the problem is solved. */
  currentStepIndex: number
  solved: boolean
  startedAt: number
  apiCallCount: number
  initialHintShown: boolean
}

export type ValidationRequest = {
  problemId: string
  previousLatex: string
  newStepLatex: string
  expectedFinalAnswer: string
  canonicalSteps?: CanonicalStep[]
  /** Where the session pointer sits when this submission was made. The Python
   * service evaluates against canonicalSteps[currentStepIndex] first, then
   * scans forward for skip-ahead matches. */
  currentStepIndex?: number
}

export type HintKind = 'initial' | 'after_step'

export type HintRequest = {
  /** "initial" = produce an opening Socratic question for step 0 with no student
   * attempt yet. "after_step" = standard verdict-conditioned hint. Defaults to
   * "after_step" for back-compat. */
  kind?: HintKind
  problem: Problem
  allSteps: Step[]
  /** Required when kind === 'after_step'. Omit for kind === 'initial'. */
  newStep?: Step | null
  /** Pointer into canonicalSteps for the now-active step (used to inject step
   * description / concept into the prompt). */
  currentStepIndex?: number
  /** Canonical indices the validator credited via skip-ahead. */
  skippedSteps?: number[]
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
