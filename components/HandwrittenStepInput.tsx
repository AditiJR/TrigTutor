'use client'

import { useRef, useState } from 'react'
import { InlineMath } from 'react-katex'
import 'katex/dist/katex.min.css'

interface Props {
  onLatexReady: (latex: string) => void
  disabled: boolean
}

type State =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'confirming'; latex: string; rawText: string }
  | { type: 'error'; message: string }

export function HandwrittenStepInput({ onLatexReady, disabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>({ type: 'idle' })
  const [editedLatex, setEditedLatex] = useState('')

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setState({ type: 'loading' })

    try {
      const form = new FormData()
      form.append('image', file)
      const res = await fetch('/api/ocr?mode=step', { method: 'POST', body: form })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if ((err as { error?: string }).error === 'rate_limited') {
          setState({ type: 'error', message: 'Too many uploads — wait a moment and try again.' })
        } else {
          setState({ type: 'error', message: "Couldn't read that image. Try a clearer photo." })
        }
        return
      }

      const data = (await res.json()) as {
        latex: string
        confidence: number
        rawText: string
        needsConfirmation: boolean
      }

      if (!data.latex.trim()) {
        setState({ type: 'confirming', latex: '', rawText: data.rawText ?? '' })
        setEditedLatex('')
        return
      }

      if (!data.needsConfirmation) {
        onLatexReady(data.latex)
        setState({ type: 'idle' })
      } else {
        setState({ type: 'confirming', latex: data.latex, rawText: data.rawText ?? '' })
        setEditedLatex(data.latex)
      }
    } catch (err) {
      console.error('[HandwrittenStepInput]', err)
      setState({ type: 'error', message: 'Something went wrong. Please try again.' })
    }
  }

  const handleConfirm = () => {
    const latex = editedLatex.trim()
    if (!latex) return
    onLatexReady(latex)
    setState({ type: 'idle' })
  }

  const handleDismiss = () => setState({ type: 'idle' })

  const showStrip = state.type === 'confirming' || state.type === 'error'

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-hidden="true"
        onChange={handleFileChange}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || state.type === 'loading'}
        title="Photograph your handwritten step"
        aria-label="Upload photo of handwritten step"
        className="border border-outline hover:border-secondary text-secondary hover:bg-surface-container px-4 py-3 rounded-lg font-label text-label flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40"
      >
        <span
          className={`material-symbols-outlined text-[18px] ${state.type === 'loading' ? 'animate-spin' : ''}`}
        >
          {state.type === 'loading' ? 'refresh' : 'photo_camera'}
        </span>
        {state.type === 'loading' ? 'Reading…' : 'Photo'}
      </button>

      {/* Inline confirmation / error strip */}
      {showStrip && (
        <div className="absolute bottom-full mb-2 left-0 min-w-[280px] max-w-[360px] bg-surface border border-outline rounded-lg shadow-lg p-3 z-20">
          {state.type === 'error' ? (
            <>
              <div className="flex items-start gap-2 mb-3">
                <span className="material-symbols-outlined text-[18px] text-incorrect shrink-0 mt-0.5">
                  error
                </span>
                <p className="font-body-sm text-body-sm text-on-surface">{state.message}</p>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-3 py-1.5 rounded font-label text-label text-secondary hover:bg-surface-container transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </>
          ) : state.latex === '' ? (
            <>
              <div className="flex items-start gap-2 mb-3">
                <span className="material-symbols-outlined text-[18px] text-warning shrink-0 mt-0.5">
                  warning
                </span>
                <p className="font-body-sm text-body-sm text-on-surface">
                  {"Couldn't read the writing clearly. Type your step in the field below."}
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-3 py-1.5 rounded font-label text-label text-secondary hover:bg-surface-container transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="font-body-sm text-body-sm text-secondary mb-2">Is this right?</p>

              {/* KaTeX preview */}
              <div className="bg-surface-container-low rounded px-3 py-2 mb-2 text-center overflow-x-auto min-h-[40px] flex items-center justify-center">
                {editedLatex.trim() ? (
                  <InlineMath math={editedLatex} />
                ) : (
                  <span className="text-secondary italic text-sm">empty</span>
                )}
              </div>

              {/* Editable LaTeX field */}
              <input
                type="text"
                value={editedLatex}
                onChange={(e) => setEditedLatex(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirm()
                  if (e.key === 'Escape') handleDismiss()
                }}
                placeholder="Edit LaTeX if needed…"
                className="w-full border border-outline-variant rounded px-2 py-1.5 font-mono text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
                autoFocus
              />

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-3 py-1.5 rounded font-label text-label text-secondary hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!editedLatex.trim()}
                  className="px-3 py-1.5 rounded font-label text-label bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-40"
                >
                  Use this
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
