/**
 * A "step" is a single logical transformation that produces a new mathematical
 * expression from the previous one, OR a final answer assignment. See CLAUDE.md
 * ("Definition of a step") for examples.
 *
 * This module's job: take raw student input (which may contain multiple equations
 * separated by commas/semicolons or "so"/"therefore" connectives) and split it into
 * an ordered list of independently-validatable LaTeX strings.
 */

export type ParsedSteps = {
  steps: string[]
  splitOn: string[]
}

export function splitIntoSteps(rawLatex: string): ParsedSteps {
  const trimmed = rawLatex.trim()
  if (!trimmed) return { steps: [], splitOn: [] }

  const parts: string[] = []
  const splitOn: string[] = []
  let buffer = ''
  let braceDepth = 0
  let parenDepth = 0
  let bracketDepth = 0
  let i = 0

  while (i < trimmed.length) {
    const ch = trimmed[i]
    const prev = i > 0 ? trimmed[i - 1] : ''
    const atTopLevel =
      braceDepth === 0 && parenDepth === 0 && bracketDepth === 0

    if (ch === '{' && prev !== '\\') braceDepth += 1
    if (ch === '}' && prev !== '\\' && braceDepth > 0) braceDepth -= 1
    if (ch === '(' && prev !== '\\') parenDepth += 1
    if (ch === ')' && prev !== '\\' && parenDepth > 0) parenDepth -= 1
    if (ch === '[' && prev !== '\\') bracketDepth += 1
    if (ch === ']' && prev !== '\\' && bracketDepth > 0) bracketDepth -= 1

    // split on top-level punctuation separators
    if (atTopLevel && (ch === ';' || ch === ',')) {
      const candidate = buffer.trim()
      if (candidate) {
        parts.push(candidate)
        splitOn.push(ch)
      }
      buffer = ''
      i += 1
      continue
    }

    // split on top-level discourse connectives (so / therefore / then)
    if (atTopLevel) {
      const rest = trimmed.slice(i).toLowerCase()
      const connective =
        rest.startsWith(' so ') ||
        rest.startsWith(' so,') ||
        rest.startsWith(' therefore ') ||
        rest.startsWith(' then ')
      if (connective) {
        const candidate = buffer.trim()
        if (candidate) {
          parts.push(candidate)
          splitOn.push(rest.startsWith(' therefore ') ? 'therefore' : rest.startsWith(' then ') ? 'then' : 'so')
        }
        buffer = ''
        if (rest.startsWith(' therefore ')) {
          i += ' therefore '.length
        } else if (rest.startsWith(' then ')) {
          i += ' then '.length
        } else if (rest.startsWith(' so,')) {
          i += ' so,'.length
        } else {
          i += ' so '.length
        }
        continue
      }
    }

    buffer += ch
    i += 1
  }

  const tail = buffer.trim()
  if (tail) parts.push(tail)

  return { steps: parts, splitOn }
}

/**
 * Light normalization before sending to SymPy: trim, collapse whitespace, strip
 * leading "=" or "so" tokens. Real LaTeX → SymPy normalization happens server-side.
 */
export function normalizeStepLatex(input: string): string {
  return input
    .trim()
    .replace(/^so\s+/i, '')
    .replace(/^=+\s*/, '')
    .replace(/\s+/g, ' ')
}
