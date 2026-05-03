/**
 * Spoken-math → LaTeX converter.
 *
 * MathLive's `convertSpeechToLatex` does not exist in v0.101.x, so this is
 * the only conversion path. We run multiple passes so that inner structures
 * (sqrt, trig) are resolved before outer ones (fractions).
 */

// ── Preprocessing ────────────────────────────────────────────────────────

/**
 * Insert spaces around math keywords that browsers often squish together
 * without spaces, e.g. "1byroot2" → "1 by root 2".
 */
function spacify(s: string): string {
  const kw = '(by|over|plus|minus|times|root|sqrt|squared|cubed|divided)'
  return s
    .replace(new RegExp(`(\\d)(${kw})`, 'gi'), '$1 $2')
    .replace(new RegExp(`(${kw})(\\d)`, 'gi'), '$1 $2')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Replace spoken-word numbers with digits.
 * Compound words ("forty five") must be converted BEFORE their parts.
 */
function wordNumbersToDigits(s: string): string {
  const compounds: Array<[RegExp, string]> = [
    [/\bone\s+hundred\s+(?:and\s+)?eighty\b/gi, '180'],
    [/\bforty[\s-]five\b/gi, '45'],
    [/\bthirty[\s-]?degrees?\b/gi, '30'],
    [/\bsixty[\s-]?degrees?\b/gi, '60'],
    [/\bninety[\s-]?degrees?\b/gi, '90']
  ]
  const singles: Array<[RegExp, string]> = [
    [/\bzero\b/gi, '0'],
    [/\bone\b/gi, '1'],
    [/\btwo\b/gi, '2'],
    [/\bthree\b/gi, '3'],
    [/\bfour\b/gi, '4'],
    [/\bfive\b/gi, '5'],
    [/\bsix\b/gi, '6'],
    [/\bseven\b/gi, '7'],
    [/\beight\b/gi, '8'],
    [/\bnine\b/gi, '9'],
    [/\bten\b/gi, '10'],
    [/\bthirty\b/gi, '30'],
    [/\bforty\b/gi, '40'],
    [/\bsixty\b/gi, '60'],
    [/\bninety\b/gi, '90']
  ]
  let out = s
  for (const [re, val] of [...compounds, ...singles]) {
    out = out.replace(re, val)
  }
  return out
}

function normTrig(word: string): string {
  return (
    { sine: 'sin', cosine: 'cos', tangent: 'tan', tg: 'tan' }[
      word.toLowerCase()
    ] ?? word.toLowerCase()
  )
}

// ── Replacement passes ────────────────────────────────────────────────────

/** Inverse trig — must run before plain trig */
function convertInverseTrig(s: string): string {
  return s
    .replace(
      /\b(?:arc\s*)?(sin|sine|cos|cosine|tan|tangent)\s+inverse\s+(?:of\s+)?([^\s,]+)/gi,
      (_, fn, arg) => `\\${normTrig(fn)}^{-1}(${arg})`
    )
    .replace(
      /\barc(sin|sine|cos|cosine|tan|tangent)\s+(?:of\s+)?([^\s,]+)/gi,
      (_, fn, arg) => `\\arc${normTrig(fn)}(${arg})`
    )
}

/** Trig with explicit power ("sin squared theta") — before plain trig */
function convertTrigPower(s: string): string {
  return s
    .replace(
      /\b(sin|sine|cos|cosine|tan|tangent)\s+squared?\s+(?:of\s+)?(\S+)/gi,
      (_, fn, arg) => `\\${normTrig(fn)}^2(${arg})`
    )
    .replace(
      /\b(sin|sine|cos|cosine|tan|tangent)\s+cubed?\s+(?:of\s+)?(\S+)/gi,
      (_, fn, arg) => `\\${normTrig(fn)}^3(${arg})`
    )
}

/** Trig with pi fractions ("sin pi over 6", "cos 5pi over 6") */
function convertTrigPi(s: string): string {
  return s
    .replace(
      /\b(sin|sine|cos|cosine|tan|tangent)\s+(?:of\s+)?(\d+)\s*pi\s+(?:over|by)\s+(\d+)/gi,
      (_, fn, num, den) =>
        `\\${normTrig(fn)}\\left(\\frac{${num}\\pi}{${den}}\\right)`
    )
    .replace(
      /\b(sin|sine|cos|cosine|tan|tangent)\s+(?:of\s+)?pi\s+(?:over|by)\s+(\d+)/gi,
      (_, fn, den) =>
        `\\${normTrig(fn)}\\left(\\frac{\\pi}{${den}}\\right)`
    )
}

/** Trig with degree values ("sin 30°", "cos of 45 degrees") */
function convertTrigDegrees(s: string): string {
  return s.replace(
    /\b(sin|sine|cos|cosine|tan|tangent)\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(?:degrees?|°)?/gi,
    (_, fn, deg) => `\\${normTrig(fn)}(${deg}^\\circ)`
  )
}

/** Plain trig with a variable ("sin theta", "cos x") */
function convertTrigVariable(s: string): string {
  return s.replace(
    /\b(sin|sine|cos|cosine|tan|tangent)\s+(?:of\s+)?([a-z_\\]+\S*)/gi,
    (_, fn, arg) => {
      // skip if arg is already a LaTeX command (starts with \)
      if (arg.startsWith('\\')) return `\\${normTrig(fn)}${arg}`
      return `\\${normTrig(fn)}(${arg})`
    }
  )
}

/** Square root expressions */
function convertSqrt(s: string): string {
  return s.replace(
    /(?:square\s+root\s+of|root\s+of|root|sqrt)\s+(\d+(?:\.\d+)?)/gi,
    (_, n) => `\\sqrt{${n}}`
  )
}

// Shared division-operator pattern (covers all spoken synonyms)
const DIV = '(?:over|divided\\s+by|by|slash|÷)'
// Shared "square root" prefix pattern
const ROOT_PREFIX = '(?:square\\s+root\\s+of|root\\s+of|root|sqrt)'

/** "X / root Y" — must run BEFORE convertSqrt */
function convertFractionSqrtDenom(s: string): string {
  // Numerator: a number OR a simple LaTeX token already produced (e.g. \\pi)
  return s.replace(
    new RegExp(
      `(\\d+(?:\\.\\d+)?|\\\\[a-z]+)\\s+${DIV}\\s+${ROOT_PREFIX}\\s+(\\d+(?:\\.\\d+)?)`,
      'gi'
    ),
    (_, num, radicand) => `\\frac{${num}}{\\sqrt{${radicand}}}`
  )
}

/** "root X / Y" — must run BEFORE convertSqrt */
function convertSqrtOverFraction(s: string): string {
  return s.replace(
    new RegExp(
      `${ROOT_PREFIX}\\s+(\\d+(?:\\.\\d+)?)\\s+${DIV}\\s+(\\d+(?:\\.\\d+)?)`,
      'gi'
    ),
    (_, radicand, den) => `\\frac{\\sqrt{${radicand}}}{${den}}`
  )
}

/** "X / Y" plain fraction */
function convertFraction(s: string): string {
  return s.replace(
    new RegExp(
      `(\\d+(?:\\.\\d+)?)\\s+${DIV}\\s+(\\d+(?:\\.\\d+)?)`,
      'gi'
    ),
    (_, num, den) => `\\frac{${num}}{${den}}`
  )
}

/**
 * Remove common STT debris that can't be parsed as math —
 * stray words like "route", "root" by itself with no number, trailing
 * punctuation, etc.
 */
function cleanupArtifacts(s: string): string {
  return s
    .replace(/\broute\b/gi, '')   // misheard "root" with no number following
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Powers and exponents */
function convertPowers(s: string): string {
  return s
    .replace(/\b(\w+)\s+(?:to\s+the\s+(?:power\s+of\s+)?|raised\s+to\s+)(\d+)/gi, '$1^{$2}')
    .replace(/\b(\w+)\s+squared?\b/gi, '$1^2')   // "square" and "squared"
    .replace(/\b(\w+)\s+cubed?\b/gi, '$1^3')     // "cube" and "cubed"
}

/** Greek letters, operators, and common symbols */
function convertSymbols(s: string): string {
  return s
    .replace(/\btheta\b/gi, '\\theta')
    .replace(/\bphi\b/gi, '\\phi')
    .replace(/\blambda\b/gi, '\\lambda')
    .replace(/\balpha\b/gi, '\\alpha')
    .replace(/\bbeta\b/gi, '\\beta')
    .replace(/\bgamma\b/gi, '\\gamma')
    .replace(/\bpi\b/gi, '\\pi')
    .replace(/\bdegrees?\b/gi, '^\\circ')
    .replace(/°/g, '^\\circ')
    // "is equal to", "equals to", "equal to", "equals" → "="
    // strip the trailing "to" so "equals to 5" → "= 5" not "= to 5"
    .replace(/\b(?:is\s+)?equals?\s+to\b/gi, '=')
    .replace(/\bequals?\b/gi, '=')
    .replace(/\bplus\b/gi, '+')
    .replace(/\bminus\b/gi, '-')
    .replace(/\btimes\b/gi, '\\times')
    .replace(/\bhalf\b/gi, '\\frac{1}{2}')
    // cleanup: stray "to" left after "equals to" or "equal to" conversions
    .replace(/=\s+to\b/gi, '=')
}

// ── Main export ───────────────────────────────────────────────────────────

/**
 * Convert a natural-language math transcript to LaTeX.
 *
 * Pass order (innermost structures first):
 *   1.  spacify — insert spaces in compact forms like "1byroot2"
 *   2.  word numbers → digits
 *   3.  inverse trig  (before plain trig)
 *   4.  trig powers   (before plain trig)
 *   5.  trig + pi fractions
 *   6.  trig + degrees
 *   7.  trig + variable
 *   8.  sqrt
 *   9.  fraction with sqrt denominator  ("X over root Y")
 *   10. sqrt over number               ("root X over Y")
 *   11. plain fraction                 ("X over Y")
 *   12. powers
 *   13. symbols / Greek
 */
export function applySpokenMathFallback(transcript: string): string {
  let s = transcript.trim()

  s = spacify(s)
  s = s.replace(/\s+/g, ' ').trim()
  s = wordNumbersToDigits(s)

  s = convertInverseTrig(s)
  s = convertTrigPower(s)
  s = convertTrigPi(s)
  s = convertTrigDegrees(s)
  s = convertTrigVariable(s)

  // Fraction-with-sqrt patterns MUST run before convertSqrt so they can still
  // see the literal word "root" in the text.  If sqrt ran first it would turn
  // "root 2" into \sqrt{2} and these patterns would never match.
  s = convertFractionSqrtDenom(s)   // "1 divided by root 2" → \frac{1}{\sqrt{2}}
  s = convertSqrtOverFraction(s)    // "root 3 over 2"       → \frac{\sqrt{3}}{2}

  s = convertSqrt(s)                // remaining "root N" → \sqrt{N}

  s = convertFraction(s)            // "3 over 4" → \frac{3}{4}

  s = convertPowers(s)
  s = convertSymbols(s)
  s = cleanupArtifacts(s)

  return s
}

/** @deprecated kept for backward compatibility */
export type SpokenMathEntry = { pattern: RegExp; latex: string }
/** @deprecated kept for backward compatibility */
export const SPOKEN_MATH_DICT: SpokenMathEntry[] = []
