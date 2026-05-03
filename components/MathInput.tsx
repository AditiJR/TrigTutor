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
  /** Renders between the keyboard toggle and voiceSlot — use for the camera button. */
  handwrittenSlot?: React.ReactNode
  /** When set, injects this LaTeX into the field and clears it via onInjectedConsumed. */
  injectedLatex?: string
  onInjectedConsumed?: () => void
  /** Called when keyboard visibility changes so parent can adjust scroll */
  onKeyboardVisibilityChange?: (visible: boolean, height: number) => void
}

type InputMode = 'math' | 'text'

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
export function MathInput({
  onSubmit,
  disabled,
  placeholder,
  voiceSlot,
  handwrittenSlot,
  injectedLatex,
  onInjectedConsumed,
  onKeyboardVisibilityChange,
}: Props) {
  const fieldRef = useRef<MathFieldElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const inputContainerRef = useRef<HTMLDivElement | null>(null)
  const [value, setValue] = useState('')
  const [mathliveLoaded, setMathliveLoaded] = useState(false)
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [inputMode, setInputMode] = useState<InputMode>('math')

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
    field.focus()

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

    const sync = () => {
      const visible = Boolean(mvk.visible)
      const height = visible ? (mvk.boundingRect?.height ?? 0) : 0
      setKeyboardVisible(visible)
      setKeyboardHeight(height)
      onKeyboardVisibilityChange?.(visible, height)
    }
    mvk.addEventListener('virtual-keyboard-toggle', sync)
    mvk.addEventListener('geometrychange', sync)
    sync()

    return () => {
      mvk.removeEventListener('virtual-keyboard-toggle', sync)
      mvk.removeEventListener('geometrychange', sync)
    }
  }, [mathliveLoaded])


  // Inject LaTeX from external source (e.g. handwritten OCR result).
  // Always switches to math mode so the student sees a rendered preview.
  useEffect(() => {
    if (!injectedLatex || !mathliveLoaded) return
    setInputMode('math')
    const field = fieldRef.current
    if (!field) return
    if (field.setValue) {
      field.setValue(injectedLatex, { silenceNotifications: false })
    } else {
      field.value = injectedLatex
    }
    setValue(injectedLatex)
    field.focus()
    onInjectedConsumed?.()
  }, [injectedLatex, mathliveLoaded, onInjectedConsumed])

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
    if (inputMode === 'text') {
      if (textareaRef.current) textareaRef.current.focus()
    } else {
      const field = fieldRef.current
      if (!field) return
      if (field.setValue) {
        field.setValue('', { silenceNotifications: true })
      } else {
        field.value = ''
      }
      field.focus()
    }
  }

  const switchMode = (mode: InputMode) => {
    setInputMode(mode)
    setValue('')
    // Clear the math field when switching away from math mode
    if (mode === 'text') {
      const field = fieldRef.current
      if (field) {
        if (field.setValue) field.setValue('', { silenceNotifications: true })
        else field.value = ''
      }
      handleHide()
      setTimeout(() => textareaRef.current?.focus(), 50)
    } else {
      setTimeout(() => fieldRef.current?.focus(), 50)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit()
    }
  }

  return (
    <>
      <div className="flex flex-col gap-stack-sm">
        {/* Mode toggle tabs */}
        <div className="flex gap-1 bg-surface-container-low rounded-lg p-1 w-fit">
          <button
            type="button"
            onClick={() => switchMode('math')}
            className={`px-3 py-1.5 rounded-md font-label text-label flex items-center gap-1.5 transition-colors ${
              inputMode === 'math'
                ? 'bg-surface text-primary shadow-sm'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">functions</span>
            Math
          </button>
          <button
            type="button"
            onClick={() => switchMode('text')}
            className={`px-3 py-1.5 rounded-md font-label text-label flex items-center gap-1.5 transition-colors ${
              inputMode === 'text'
                ? 'bg-surface text-primary shadow-sm'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">text_fields</span>
            Text
          </button>
        </div>

        {/* Input area */}
        <div
          ref={inputContainerRef}
          className="relative bg-surface rounded-lg border border-outline-variant ring-0 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary shadow-sm min-h-[80px] transition-shadow cursor-text"
          onKeyDown={handleKeyDown}
          onClick={() => {
            if (inputMode === 'math') fieldRef.current?.focus()
            else textareaRef.current?.focus()
          }}
        >
          {/* MathLive field — always mounted so injectedLatex works; hidden in text mode */}
          <div style={{ display: inputMode === 'math' ? 'block' : 'none' }}>
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

          {/* Plain textarea — for typing equations like 4^2+x^2=5^2 without MathLive's math rendering */}
          {inputMode === 'text' && (
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder ?? 'Type your step, e.g. 4^2 + x^2 = 5^2'}
              rows={2}
              className="w-full resize-none bg-transparent outline-none border-none px-4 py-3 font-mono text-base text-on-surface placeholder:text-secondary"
            />
          )}
        </div>

        {/* Action row */}
        <div className="flex justify-between items-center gap-stack-md pt-1">
          {/* Keyboard toggle — only for math mode */}
          {inputMode === 'math' && (
            <button
              type="button"
              onClick={handleShow}
              disabled={!mathliveLoaded || keyboardVisible}
              className="border border-outline hover:border-secondary text-secondary hover:bg-surface-container px-4 py-3 rounded-lg font-label text-label flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">keyboard</span>
              Keyboard
            </button>
          )}

          {/* Camera and voice slots */}
          {!keyboardVisible && handwrittenSlot}
          {!keyboardVisible && voiceSlot}

          {/* Spacer so submit always goes right */}
          <div className="flex-1" />

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

      {/* Floating toolbar above MathLive keyboard (math mode only) */}
      {keyboardVisible && inputMode === 'math' && (
        <div
          className="fixed left-0 right-0 z-50 bg-surface border-t border-outline-variant shadow-[0_-4px_12px_rgba(0,0,0,0.08)] flex items-center justify-between px-4 py-2 gap-3"
          style={{ bottom: keyboardHeight }}
        >
          <button
            type="button"
            onClick={handleHide}
            className="border border-outline hover:border-secondary text-secondary hover:bg-surface-container px-3 py-2 rounded-lg font-label text-label flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">keyboard_hide</span>
            Close
          </button>

          <div className="flex items-center gap-2">
            {handwrittenSlot}
            {voiceSlot}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            className="bg-primary hover:bg-primary/90 text-on-primary px-5 py-2 rounded-lg font-label text-label flex items-center gap-2 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            Submit
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </div>
      )}
    </>
  )
}
