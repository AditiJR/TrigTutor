'use client'

import { useVoiceInput } from '@/hooks/useVoiceInput'

type Props = {
  onResult: (latex: string, rawTranscript: string) => void
  disabled?: boolean
}

/**
 * Push-to-talk button. Uses Web Speech API → MathLive speech parser → LaTeX.
 * No Claude round-trip. See CLAUDE.md ("Voice input flow").
 *
 * Pointer capture is used so the browser keeps sending pointer events to this
 * button even if the finger/cursor drifts outside it while held down. This
 * prevents the "releases after one second" bug caused by pointerleave firing.
 */
export function VoiceInput({ onResult, disabled }: Props) {
  const { state, transcript, supported, start, stop } = useVoiceInput({ onResult })
  const recording = state === 'recording'

  if (!supported) {
    return (
      <span className="text-xs text-slate-500">
        Voice input isn&apos;t supported in this browser.
      </span>
    )
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Capture the pointer so events keep firing here even if the cursor/finger
    // moves off the button — this is what keeps the button "held".
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
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        // No onPointerLeave — with capture active the pointer can't "leave"
        // until explicitly released, so that event is irrelevant.
        className={`select-none rounded-md px-3 py-2 text-sm font-medium shadow-sm transition ${
          recording
            ? 'bg-red-600 text-white'
            : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {recording ? 'Listening…' : 'Hold to talk'}
        {state === 'processing' ? ' (processing…)' : ''}
      </button>
      {transcript && (
        <span className="text-xs italic text-slate-500">{transcript}</span>
      )}
    </div>
  )
}
