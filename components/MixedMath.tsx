'use client'

import type { ReactNode } from 'react'
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

/** Scroll + min-w-0 so KaTeX display math stays inside narrow columns. */
function BlockMathShell({ children }: { children: ReactNode }) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-x-auto">
      <div className="flex min-w-0 justify-center">
        <div className="min-w-0 max-w-full">{children}</div>
      </div>
    </div>
  )
}

function InlineMathShell({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block max-w-full min-w-0 overflow-x-auto align-middle">{children}</span>
  )
}

function MathShell({ block, children }: { block?: boolean; children: ReactNode }) {
  return block ? <BlockMathShell>{children}</BlockMathShell> : <InlineMathShell>{children}</InlineMathShell>
}

export function MixedMath({ text, block }: { text: string; block?: boolean }) {
  const trimmed = text.trim()

  // $$...$$ → block math
  const blockDelim = trimmed.match(/^\$\$([\s\S]+)\$\$$/)
  if (blockDelim?.[1]) {
    return (
      <BlockMathShell>
        <BlockMath math={blockDelim[1].trim()} />
      </BlockMathShell>
    )
  }

  // $...$ wrapping the entire string → inline math
  const inlineDelim = trimmed.match(/^\$((?:[^$\\]|\\.)+)\$$/)
  if (inlineDelim?.[1]) {
    return (
      <MathShell block={block}>
        <InlineMath math={inlineDelim[1].trim()} />
      </MathShell>
    )
  }

  // Mixed prose: contains at least one $...$ segment
  if (trimmed.includes('$')) {
    const parts = splitMixed(trimmed)
    if (parts.some((p) => p.type === 'math')) {
      return (
        <MathShell block={block}>
          <span className="max-w-full min-w-0 break-words [overflow-wrap:anywhere]">
            {parts.map((part, i) =>
              part.type === 'math' ? (
                <InlineMath key={i} math={part.content} />
              ) : (
                <span key={i} className="break-words [overflow-wrap:anywhere]">
                  {part.content}
                </span>
              )
            )}
          </span>
        </MathShell>
      )
    }
  }

  // Plain text (no LaTeX markers) — render as-is to avoid italic math rendering
  if (!looksLikeLatex(trimmed)) {
    return block ? (
      <div className="w-full min-w-0 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]">
        {trimmed}
      </div>
    ) : (
      <span className="break-words [overflow-wrap:anywhere]">{trimmed}</span>
    )
  }

  // Pure LaTeX without delimiters
  return (
    <MathShell block={block}>
      {block ? <BlockMath math={trimmed} /> : <InlineMath math={trimmed} />}
    </MathShell>
  )
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
