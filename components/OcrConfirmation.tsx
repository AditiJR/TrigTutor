'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { BlockMath } from 'react-katex'

type Props = {
  initialLatex: string
  confidence: number | null
  imageUrl: string | null
  configured?: boolean
  onConfirm: (latex: string) => void
}

type MathFieldEl = HTMLElement & {
  value: string
  setValue?: (v: string, opts?: { silenceNotifications?: boolean }) => void
}

/**
 * Shows the extracted problem rendered alongside the source image. The student
 * can edit the LaTeX directly via a MathLive field before confirming. Mandatory
 * step per CLAUDE.md ("OCR confirmation step is mandatory").
 *
 * The MathLive value is seeded ONCE when the editor becomes ready. After that,
 * the user owns the value — re-seeding on every keystroke (the original bug)
 * would reset the cursor every time they typed a character.
 */
export function OcrConfirmation({
  initialLatex,
  confidence,
  imageUrl,
  configured = true,
  onConfirm
}: Props) {
  const fieldRef = useRef<MathFieldEl | null>(null)
  const [latex, setLatex] = useState(initialLatex)
  const [mathliveLoaded, setMathliveLoaded] = useState(false)
  const initialLatexRef = useRef(initialLatex)

  useEffect(() => {
    let cancelled = false
    import('mathlive').then(() => {
      if (!cancelled) setMathliveLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!mathliveLoaded) return
    const field = fieldRef.current
    if (!field) return

    const seed = initialLatexRef.current
    if (field.setValue) {
      field.setValue(seed, { silenceNotifications: true })
    } else {
      field.value = seed
    }

    const handler = (event: Event) => {
      const target = event.target as MathFieldEl
      setLatex(target.value ?? '')
    }
    field.addEventListener('input', handler)
    return () => field.removeEventListener('input', handler)
  }, [mathliveLoaded])

  const lowConfidence =
    configured && confidence !== null && confidence < 0.85

  return (
    <div className="space-y-4">
      {!configured && (
        <div className="rounded-md border border-unparseable/30 bg-unparseable/10 p-3 text-sm text-unparseable">
          OCR isn&apos;t configured (no Mathpix key set). Type the problem
          below using the math editor and we&apos;ll start solving.
        </div>
      )}
      {lowConfidence && (
        <div className="rounded-md border border-unparseable/30 bg-unparseable/10 p-3 text-sm text-unparseable">
          We&apos;re not 100% sure we read this right — please double-check
          before solving.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {imageUrl && (
          <figure className="space-y-1">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Original
            </div>
            <Image
              src={imageUrl}
              alt="Uploaded problem"
              width={600}
              height={400}
              unoptimized
              className="rounded-lg border border-slate-200"
            />
          </figure>
        )}
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Extracted (preview)
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            {latex ? (
              <BlockMath math={latex} />
            ) : (
              <span className="text-slate-400">(empty)</span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase text-slate-500">
          Edit if needed
        </label>
        <math-field
          ref={fieldRef as unknown as React.Ref<HTMLElement>}
          style={{ fontSize: '1.125rem', minHeight: '3rem', display: 'block' }}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onConfirm(latex)}
          disabled={!latex.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Looks right — start solving
        </button>
      </div>
    </div>
  )
}
