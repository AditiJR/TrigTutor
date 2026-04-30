'use client'

import { useVoiceInput } from '@/hooks/useVoiceInput'

type Props = {
  onResult: (latex: string, rawTranscript: string) => void
  disabled?: boolean
}

/**
 * Push-to-talk circular mic button. Uses Web Speech API → MathLive speech
 * parser → LaTeX. No Claude round-trip.
 *
 * Pointer capture keeps the button "held" even if the finger/cursor drifts
 * outside — this prevents the one-second-release bug caused by pointerleave.
 */
export function VoiceInput({ onResult, disabled }: Props) {
  const { state, transcript, supported, start, stop } = useVoiceInput({ onResult })
  const recording = state === 'recording'
  const processing = state === 'processing'

  if (!supported) {
    return (
      <span className="font-body-sm text-body-sm text-secondary">
        Voice not supported
      </span>
    )
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    start()
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    stop()
  }

  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    stop()
  }

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <button
        type="button"
        aria-label={recording ? 'Listening — release to stop' : 'Hold to talk'}
        disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className={`w-14 h-14 rounded-full flex items-center justify-center border shadow-sm transition-colors focus:outline-none focus:ring-4 focus:ring-primary/20 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed select-none ${
          recording
            ? 'bg-incorrect text-on-primary border-incorrect/50 ring-4 ring-incorrect/20'
            : processing
              ? 'bg-warning/20 text-warning border-warning/30'
              : 'bg-surface-container hover:bg-surface-container-high text-on-surface border-border-subtle'
        }`}
      >
        <span
          className="material-symbols-outlined"
          style={recording ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          {processing ? 'hourglass_empty' : 'mic'}
        </span>
      </button>
      {transcript && (
        <span className="font-body-sm text-body-sm text-secondary truncate max-w-[100px] text-center leading-tight">
          {transcript}
        </span>
      )}
    </div>
  )
}
