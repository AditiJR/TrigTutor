'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { BlockMath, InlineMath } from 'react-katex'
import type { Diagram, OcrProvider } from '@/lib/types'

type Props = {
  initialLatex: string
  confidence: number | null
  imageUrl: string | null
  configured?: boolean
  provider?: OcrProvider
  diagram?: Diagram | null
  generatingSteps?: boolean
  onConfirm: (latex: string) => void
  onCancel?: () => void
}

type MathFieldEl = HTMLElement & {
  value: string
  setValue?: (v: string, opts?: { silenceNotifications?: boolean }) => void
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> },
        HTMLElement
      >
    }
  }
}

/**
 * Shows the extracted problem rendered alongside the source image. The student
 * can edit the LaTeX directly via a MathLive field before confirming.
 *
 * The MathLive value is seeded ONCE when the editor becomes ready to avoid
 * resetting the cursor on every keystroke.
 */
export function OcrConfirmation({
  initialLatex,
  confidence,
  imageUrl,
  configured = true,
  provider = 'none',
  diagram = null,
  generatingSteps = false,
  onConfirm,
  onCancel
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

  const lowConfidence = provider !== 'none' && confidence !== null && confidence < 0.85

  return (
    <>
      {/* Provider banners */}
      {provider === 'none' && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-stack-sm flex items-start gap-stack-sm shadow-sm">
          <span
            className="material-symbols-outlined text-warning mt-0.5"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            info
          </span>
          <div>
            <p className="font-body-sm text-body-sm text-[#92400E] font-semibold">
              No OCR engine ran
            </p>
            <p className="font-body-sm text-body-sm text-[#B45309]">
              Mathpix isn&apos;t configured and the local pix2tex model isn&apos;t
              installed. Type your problem in the editor below to continue.
            </p>
          </div>
        </div>
      )}

      {(provider === 'gemini-vision' || provider === 'claude-vision') && (
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-stack-sm flex items-start gap-stack-sm shadow-sm">
          <span
            className="material-symbols-outlined text-primary mt-0.5"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            visibility
          </span>
          <div>
            <p className="font-body-sm text-body-sm text-[#1E3A8A] font-semibold">
              {provider === 'gemini-vision' ? 'Extracted with Gemini Vision' : 'Extracted with Claude Vision'}
            </p>
            <p className="font-body-sm text-body-sm text-[#1E40AF]">
              The math AND any diagram in your image have been parsed. Double-check
              the equation below before solving.
            </p>
          </div>
        </div>
      )}

      {/* Low-confidence warning */}
      {lowConfidence && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-stack-sm flex items-start gap-stack-sm shadow-sm">
          <span
            className="material-symbols-outlined text-warning mt-0.5"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            warning
          </span>
          <div>
            <p className="font-body-sm text-body-sm text-[#92400E] font-semibold">
              Low confidence extraction
            </p>
            <p className="font-body-sm text-body-sm text-[#B45309]">
              The image was a bit tricky to read. Please verify the equation below
              and correct it if needed.
            </p>
          </div>
        </div>
      )}

      {/* Diagram facts (when Claude Vision detected a figure) */}
      {diagram && (
        <DiagramSummary diagram={diagram} />
      )}

      {/* Two-column: image vs extraction */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-lg items-start">
        {/* Left: original image */}
        <section className="bg-surface border border-border-subtle rounded-xl p-stack-md flex flex-col gap-stack-sm shadow-sm">
          <div className="flex items-center gap-2 px-1">
            <span className="material-symbols-outlined text-[18px] text-secondary">image</span>
            <h2 className="font-label text-label text-secondary uppercase tracking-wider">
              Original Upload
            </h2>
          </div>
          <div className="w-full aspect-[4/3] bg-surface-container-low rounded-lg border border-border-subtle overflow-hidden relative flex items-center justify-center">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt="Uploaded math problem"
                fill
                unoptimized
                className="object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-secondary">
                <span className="material-symbols-outlined text-3xl">image_not_supported</span>
                <span className="font-body-sm text-body-sm">No preview available</span>
              </div>
            )}
          </div>
        </section>

        {/* Right: extracted math + editor */}
        <section className="bg-surface border border-border-subtle rounded-xl p-stack-md flex flex-col gap-stack-md shadow-sm">
          {/* Read-only rendered preview */}
          <div className="flex flex-col gap-stack-sm">
            <div className="flex items-center gap-2 px-1">
              <span className="material-symbols-outlined text-[18px] text-primary">
                psychology
              </span>
              <h2 className="font-label text-label text-primary uppercase tracking-wider">
                Extracted Math
              </h2>
            </div>
            <div className="w-full bg-surface-container rounded-lg border border-border-subtle p-stack-md flex items-center justify-center min-h-[100px]">
              {latex ? (
                <BlockMath math={latex} />
              ) : (
                <span className="font-body-sm text-body-sm text-secondary italic">
                  Nothing extracted yet — type your problem below.
                </span>
              )}
            </div>
          </div>

          {/* Editable MathLive field */}
          <div className="flex flex-col gap-stack-sm">
            <label
              className="font-label text-label text-secondary px-1"
              htmlFor="math-editor"
            >
              Manual Corrections
            </label>
            <math-field
              id="math-editor"
              ref={fieldRef as unknown as React.Ref<HTMLElement>}
              style={{ fontSize: '1.125rem', minHeight: '3.5rem', display: 'block' }}
            />
            <p className="font-body-sm text-body-sm text-secondary px-1">
              Tap directly on the math above to edit, or use your keyboard.
            </p>
          </div>
        </section>
      </div>

      {/* Action row */}
      <div className="flex flex-col md:flex-row justify-end items-center pt-stack-md border-t border-border-subtle gap-stack-sm">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full md:w-auto px-6 py-3 rounded-lg font-label text-label text-secondary hover:bg-surface-container-low transition-colors border border-transparent hover:border-border-subtle h-touch-target flex items-center justify-center"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={() => onConfirm(latex)}
          disabled={!latex.trim() || generatingSteps}
          className="w-full md:w-auto bg-primary text-on-primary font-body-sm text-body-sm py-3 px-8 rounded-lg shadow-sm hover:bg-primary/90 transition-colors font-semibold flex items-center justify-center gap-2 h-touch-target disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generatingSteps ? (
            <>
              <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
              Generating solution path…
            </>
          ) : (
            <>
              Looks right — start solving
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </>
          )}
        </button>
      </div>
    </>
  )
}

const SHAPE_LABELS: Record<Diagram['shape'], string> = {
  right_triangle: 'Right triangle',
  general_triangle: 'Triangle',
  unit_circle: 'Unit circle',
  circle: 'Circle',
  rectangle: 'Rectangle',
  other: 'Figure'
}

function DiagramSummary({ diagram }: { diagram: Diagram }) {
  const hasFacts = diagram.given.length > 0 || diagram.unknown !== null

  return (
    <section className="bg-surface border border-border-subtle rounded-xl p-stack-md flex flex-col gap-stack-sm shadow-sm">
      <div className="flex items-center gap-2 px-1">
        <span
          className="material-symbols-outlined text-[18px] text-primary"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          shapes
        </span>
        <h2 className="font-label text-label text-primary uppercase tracking-wider">
          Detected diagram
        </h2>
        <span className="ml-auto bg-primary-fixed/40 text-primary px-2 py-0.5 rounded font-label text-label">
          {SHAPE_LABELS[diagram.shape]}
        </span>
      </div>

      {diagram.description && (
        <p className="font-body-sm text-body-sm text-on-surface px-1">
          {diagram.description}
        </p>
      )}

      {hasFacts && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-sm pt-1">
          {diagram.given.length > 0 && (
            <div className="bg-surface-container-low border border-border-subtle rounded-lg p-stack-sm">
              <div className="font-label text-label text-secondary uppercase tracking-wider mb-1">
                Given
              </div>
              <ul className="flex flex-col gap-1">
                {diagram.given.map((q, i) => (
                  <li key={i} className="font-body-sm text-body-sm text-on-surface">
                    <span className="font-semibold">{q.label || '—'}</span>
                    {q.value !== null && (
                      <>
                        {' = '}
                        <span>{q.value}</span>
                        {q.unit && <span className="text-secondary"> {q.unit}</span>}
                      </>
                    )}
                    <span className="text-secondary"> ({q.type})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {diagram.unknown && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-stack-sm">
              <div className="font-label text-label text-warning uppercase tracking-wider mb-1">
                Solve for
              </div>
              <div className="font-body text-body text-on-surface">
                <span className="font-semibold">{diagram.unknown.label || '—'}</span>
                <span className="text-secondary"> ({diagram.unknown.type})</span>
              </div>
            </div>
          )}
        </div>
      )}

      {diagram.impliedRelationLatex && (
        <div className="pt-1">
          <div className="font-label text-label text-secondary uppercase tracking-wider mb-1 px-1">
            Likely relation
          </div>
          <div className="bg-surface-container rounded-lg border border-border-subtle p-stack-sm flex items-center justify-center">
            <InlineMath math={diagram.impliedRelationLatex} />
          </div>
        </div>
      )}
    </section>
  )
}
