'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { applySpokenMathFallback } from '@/lib/spokenMathDict'

type VoiceState = 'idle' | 'recording' | 'processing'

type Options = {
  onResult: (latex: string, rawTranscript: string) => void
  lang?: string
}

type SpeechRecognitionEventLike = {
  results: { 0: { transcript: string } }[] & { length: number }
}

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: (e: SpeechRecognitionEventLike) => void
  onerror: (e: unknown) => void
  onend: () => void
  start: () => void
  stop: () => void
}

/**
 * Push-to-talk voice → LaTeX hook.
 *
 * 1. Web Speech API streams interim transcripts.
 * 2. On stop, the final transcript is fed to MathLive's speech parser; if that returns
 *    nothing useful we fall back to the spoken-math dictionary.
 * 3. No Claude round-trip — see CLAUDE.md ("Voice input flow").
 */
export function useVoiceInput({ onResult, lang = 'en-US' }: Options) {
  const [state, setState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [supported, setSupported] = useState(true)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const transcriptRef = useRef('')
  // Use a ref for state so start/stop callbacks never have stale closures —
  // React batches setState so the closure value lags behind the ref value.
  const stateRef = useRef<VoiceState>('idle')
  const onResultRef = useRef(onResult)

  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  useEffect(() => {
    const w =
      typeof window !== 'undefined'
        ? (window as unknown as Record<string, unknown>)
        : null
    const Ctor = w
      ? (w.SpeechRecognition as unknown) || (w.webkitSpeechRecognition as unknown)
      : null
    if (!Ctor) {
      setSupported(false)
      return
    }

    const rec = new (Ctor as { new (): SpeechRecognitionLike })()
    rec.lang = lang
    rec.interimResults = true
    // continuous = true prevents the browser from auto-stopping on silence,
    // which was causing the button to "unselect" mid-hold.
    rec.continuous = true

    rec.onresult = (event) => {
      let combined = ''
      for (let i = 0; i < event.results.length; i += 1) {
        combined += event.results[i]?.[0]?.transcript ?? ''
      }
      transcriptRef.current = combined
      setTranscript(combined)
    }

    rec.onerror = (err) => {
      console.error('[VoiceInput] SpeechRecognition error:', err)
      stateRef.current = 'idle'
      setState('idle')
    }

    rec.onend = () => {
      // Only process if stop() flagged that we want the transcript.
      if (stateRef.current !== 'processing') {
        stateRef.current = 'idle'
        setState('idle')
        return
      }

      const final = transcriptRef.current.trim()
      if (!final) {
        stateRef.current = 'idle'
        setState('idle')
        return
      }

      const latex = spokenToLatex(final)
      onResultRef.current(latex, final)
      stateRef.current = 'idle'
      setState('idle')
    }

    recognitionRef.current = rec
  }, [lang])

  // start and stop are stable — no state in deps because we use stateRef.
  const start = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec || stateRef.current !== 'idle') return
    stateRef.current = 'recording'
    setState('recording')
    setTranscript('')
    transcriptRef.current = ''
    try {
      rec.start()
    } catch (err) {
      console.error('[VoiceInput] Failed to start recognition:', err)
      stateRef.current = 'idle'
      setState('idle')
    }
  }, [])

  const stop = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec || stateRef.current !== 'recording') return
    stateRef.current = 'processing'
    setState('processing')
    rec.stop()
  }, [])

  return { state, transcript, supported, start, stop }
}

/**
 * Convert a spoken transcript to LaTeX.
 *
 * MathLive v0.101.x does not export `convertSpeechToLatex`, so the
 * spoken-math dictionary is the sole conversion path.
 */
function spokenToLatex(spoken: string): string {
  if (!spoken.trim()) return ''
  return applySpokenMathFallback(spoken)
}
