'use client'

import { BlockMath, InlineMath } from 'react-katex'

type Props = {
  latex: string
  block?: boolean
}

export function ProblemDisplay({ latex, block = true }: Props) {
  if (!latex) return null
  return block ? <BlockMath math={latex} /> : <InlineMath math={latex} />
}
