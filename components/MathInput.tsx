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
  /** Renders between the keyboard toggle and the submit button — use for the mic button. */
  voiceSlot?: React.ReactNode
}

function getMVK(): VirtualKeyboard | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { mathVirtualKeyboard?: VirtualKeyboard }
  return w.mathVirtualKeyboard ?? null
}

/**
 * MathLive-backed math input.
 *
 * Uses "manual" keyboard policy so the virtual keyboard only opens when the
 * user explicitly presses the keyboard button — consistent across desktop and
 * mobile. The `voiceSlot` prop is rendered in the action row between the
 * keyboard toggle and submit buttons so the solve session can pass in the
 * circular mic button.
 */
export function MathInput({ onSubmit, disabled, placeholder, voiceSlot }: Props) {
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit()
    }
  }

  return (
    <div className="flex flex-col gap-stack-sm">
      {/* Math field */}
      <div
        className="relative bg-surface rounded-lg border border-outline-variant ring-0 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary shadow-sm min-h-[80px] transition-shadow cursor-text"
        onKeyDown={handleKeyDown}
      >
        <math-field
          ref={fieldRef as unknown as React.Ref<HTMLElement>}
          aria-label={placeholder ?? 'Enter your next step'}
          style={{
            fontSize: '1.25rem',
            minHeight: '5rem',
            display: 'block',
            border: 'none',
            borderRadius: '0.5rem',
            outline: 'none',
            boxShadow: 'none',
            padding: '0.75rem 1rem'
          }}
        />
      </div>

      {/* Action row */}
      <div className="flex justify-between items-center gap-stack-md pt-1">
        {/* Keyboard toggle */}
        <button
          type="button"
          onClick={keyboardVisible ? handleHide : handleShow}
          disabled={!mathliveLoaded}
          className="border border-outline hover:border-secondary text-secondary hover:bg-surface-container px-4 py-3 rounded-lg font-label text-label flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[18px]">keyboard</span>
          {keyboardVisible ? 'Hide Keyboard' : 'Show Keyboard'}
        </button>

        {/* Voice slot (mic button rendered by parent) */}
        {voiceSlot}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="bg-primary hover:bg-primary/90 text-on-primary px-6 py-3 rounded-lg font-label text-label flex items-center gap-2 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Step
          <span className="material-symbols-outlined text-[18px]">send</span>
        </button>
      </div>
    </div>
  )
}
