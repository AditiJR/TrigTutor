'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          ref?: React.Ref<HTMLElement>
        },
        HTMLElement
      >
    }
  }
}

type MathFieldElement = HTMLElement & {
  value: string
  setValue?: (v: string, opts?: { silenceNotifications?: boolean }) => void
  mathVirtualKeyboardPolicy?: 'auto' | 'manual' | 'sandboxed'
}

type VirtualKeyboard = {
  show: (options?: { animate?: boolean }) => void
  hide: (options?: { animate?: boolean }) => void
  visible: boolean
  boundingRect: DOMRect
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

type Props = {
  onSubmit: (latex: string) => void
  disabled?: boolean
  placeholder?: string
}

function getMVK(): VirtualKeyboard | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { mathVirtualKeyboard?: VirtualKeyboard }
  return w.mathVirtualKeyboard ?? null
}

/**
 * MathLive-backed math input.
 *
 * MathLive's keyboard policy:
 *   - "auto" (default): only auto-shows on touch devices, not on desktop.
 *   - "manual": never auto-shows; only opens when we call show() explicitly.
 *
 * We use "manual" so behavior is identical on desktop and mobile, and we
 * provide an explicit toolbar button that the user clicks to open it.
 *
 * MathLive itself handles body padding when the keyboard is open, so we
 * don't add any custom layout shifting.
 */
export function MathInput({ onSubmit, disabled, placeholder }: Props) {
  const fieldRef = useRef<MathFieldElement | null>(null)
  const [value, setValue] = useState('')
  const [mathliveLoaded, setMathliveLoaded] = useState(false)
  const [keyboardVisible, setKeyboardVisible] = useState(false)

  useEffect(() => {
    let cancelled = false
    import('mathlive')
      .then(() => {
        if (!cancelled) setMathliveLoaded(true)
      })
      .catch((err) => console.error('Failed to load mathlive:', err))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!mathliveLoaded) return
    const field = fieldRef.current
    if (!field) return

    field.mathVirtualKeyboardPolicy = 'manual'

    const onInput = (event: Event) => {
      const target = event.target as MathFieldElement
      setValue(target.value ?? '')
    }
    field.addEventListener('input', onInput)
    return () => {
      field.removeEventListener('input', onInput)
    }
  }, [mathliveLoaded])

  useEffect(() => {
    if (!mathliveLoaded) return
    const mvk = getMVK()
    if (!mvk) return

    const sync = () => setKeyboardVisible(Boolean(mvk.visible))
    mvk.addEventListener('virtual-keyboard-toggle', sync)
    mvk.addEventListener('geometrychange', sync)
    sync()

    return () => {
      mvk.removeEventListener('virtual-keyboard-toggle', sync)
      mvk.removeEventListener('geometrychange', sync)
    }
  }, [mathliveLoaded])

  const handleShow = () => {
    const mvk = getMVK()
    if (!mvk) return
    fieldRef.current?.focus()
    mvk.show({ animate: true })
  }

  const handleHide = () => {
    const mvk = getMVK()
    if (!mvk) return
    mvk.hide({ animate: true })
  }

  const handleSubmit = () => {
    const latex = value.trim()
    if (!latex || disabled) return
    onSubmit(latex)
    setValue('')
    const field = fieldRef.current
    if (!field) return
    if (field.setValue) {
      field.setValue('', { silenceNotifications: true })
    } else {
      field.value = ''
    }
    field.focus()
  }

  return (
    <div className="space-y-2">
      <math-field
        ref={fieldRef as unknown as React.Ref<HTMLElement>}
        aria-label={placeholder ?? 'Enter your next step'}
        style={{ fontSize: '1.25rem', minHeight: '3rem', display: 'block' }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={keyboardVisible ? handleHide : handleShow}
          disabled={!mathliveLoaded}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
        >
          {keyboardVisible ? 'Hide math keyboard' : 'Show math keyboard'}
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Submit step
        </button>
      </div>
    </div>
  )
}
