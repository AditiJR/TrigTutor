/**
 * Fallback spoken-math → LaTeX dictionary. MathLive's speech parser is the primary path;
 * this is only consulted when MathLive returns an empty / clearly-wrong parse for common
 * trig phrasings.
 */

export type SpokenMathEntry = {
  pattern: RegExp
  latex: string
}

export const SPOKEN_MATH_DICT: SpokenMathEntry[] = [
  { pattern: /\bsine of (\d+)\s*degrees?\b/i, latex: '\\sin($1^\\circ)' },
  { pattern: /\bcosine of (\d+)\s*degrees?\b/i, latex: '\\cos($1^\\circ)' },
  { pattern: /\btangent of (\d+)\s*degrees?\b/i, latex: '\\tan($1^\\circ)' },
  { pattern: /\bsin\s+(\d+)\b/i, latex: '\\sin($1)' },
  { pattern: /\bcos\s+(\d+)\b/i, latex: '\\cos($1)' },
  { pattern: /\btan\s+(\d+)\b/i, latex: '\\tan($1)' },
  { pattern: /\bpi\b/i, latex: '\\pi' },
  { pattern: /\btheta\b/i, latex: '\\theta' },
  { pattern: /\bsquare root of (\d+)\b/i, latex: '\\sqrt{$1}' },
  { pattern: /\b(\d+)\s+over\s+(\d+)\b/i, latex: '\\frac{$1}{$2}' }
]

export function applySpokenMathFallback(transcript: string): string {
  let out = transcript
  for (const { pattern, latex } of SPOKEN_MATH_DICT) {
    out = out.replace(pattern, latex)
  }
  return out
}
