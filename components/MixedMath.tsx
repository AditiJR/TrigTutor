'use client'

import { BlockMath, InlineMath } from 'react-katex'
import 'katex/dist/katex.min.css'

/**
 * Renders a string that may be:
 *   - Pure LaTeX with outer $...$ or $$...$$ delimiters  → strips and renders
 *   - Mixed prose with inline $...$ math  → splits and renders each part
 *   - Pure LaTeX with no delimiters  → renders directly with InlineMath/BlockMath
 */
/** Returns true if the string looks like it contains LaTeX syntax. */
function looksLikeLatex(s: string): boolean {
  return /[\\^_{}]/.test(s) || s.includes('$')
}

export function MixedMath({ text, block }: { text: string; block?: boolean }) {
  const trimmed = text.trim()

  // $$...$$ → block math
  const blockDelim = trimmed.match(/^\$\$([\s\S]+)\$\$$/)
  if (blockDelim?.[1]) return <BlockMath math={blockDelim[1].trim()} />

  // $...$ wrapping the entire string → inline math
  const inlineDelim = trimmed.match(/^\$((?:[^$\\]|\\.)+)\$$/)
  if (inlineDelim?.[1]) return <InlineMath math={inlineDelim[1].trim()} />

  // Mixed prose: contains at least one $...$ segment
  if (trimmed.includes('$')) {
    const parts = splitMixed(trimmed)
    if (parts.some((p) => p.type === 'math')) {
      return (
        <span>
          {parts.map((part, i) =>
            part.type === 'math' ? (
              <InlineMath key={i} math={part.content} />
            ) : (
              <span key={i}>{part.content}</span>
            )
          )}
        </span>
      )
    }
  }

  // Plain text (no LaTeX markers) — render as-is to avoid italic math rendering
  if (!looksLikeLatex(trimmed)) {
    return block ? <div className="text-center">{trimmed}</div> : <span>{trimmed}</span>
  }

  // Pure LaTeX without delimiters
  if (block) return <BlockMath math={trimmed} />
  return <InlineMath math={trimmed} />
}

type Part = { type: 'text' | 'math'; content: string }

function splitMixed(text: string): Part[] {
  const parts: Part[] = []
  const re = /\$((?:[^$\\]|\\.)+)\$/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: 'text', content: text.slice(last, match.index) })
    }
    parts.push({ type: 'math', content: (match[1] ?? '').trim() })
    last = match.index + match[0].length
  }

  if (last < text.length) {
    parts.push({ type: 'text', content: text.slice(last) })
  }

  return parts
}
