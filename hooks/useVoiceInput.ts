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
  const shouldProcessOnEndRef = useRef(false)
  const onResultRef = useRef(onResult)

  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  useEffect(() => {
    const w = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : null
    const Ctor = w
      ? ((w.SpeechRecognition as unknown) ||
          (w.webkitSpeechRecognition as unknown))
      : null
    if (!Ctor) {
      setSupported(false)
      return
    }
    const rec = new (Ctor as { new (): SpeechRecognitionLike })()
    rec.lang = lang
    rec.interimResults = true
    // continuous = true prevents the browser auto-stopping on silence, which
    // was causing the button to "unselect" mid-hold.
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
      console.error('SpeechRecognition error:', err)
      setState('idle')
    }
    rec.onend = () => {
      const shouldProcess = shouldProcessOnEndRef.current
      shouldProcessOnEndRef.current = false
      if (!shouldProcess) {
        setState('idle')
        return
      }

      const final = transcriptRef.current.trim()
      if (!final) {
        setState('idle')
        return
      }

      setState('processing')
      void spokenToLatex(final)
        .then((latex) => onResultRef.current(latex, final))
        .finally(() => setState('idle'))
    }
    recognitionRef.current = rec
  }, [lang])

  const start = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec || state !== 'idle') return
    shouldProcessOnEndRef.current = false
    setTranscript('')
    transcriptRef.current = ''
    setState('recording')
    try {
      rec.start()
    } catch (err) {
      console.error('Failed to start recognition:', err)
      setState('idle')
    }
  }, [state])

  const stop = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec || state !== 'recording') return
    shouldProcessOnEndRef.current = true
    setState('processing')
    rec.stop()
  }, [state])

  return { state, transcript, supported, start, stop }
}

async function spokenToLatex(spoken: string): Promise<string> {
  if (!spoken.trim()) return ''
  // Try MathLive first if available; fall back to dictionary on error/empty.
  try {
    const mathlive = (await import('mathlive')) as unknown as {
      convertSpeechToLatex?: (s: string) => string | null
    }
    if (typeof mathlive.convertSpeechToLatex === 'function') {
      const latex = mathlive.convertSpeechToLatex(spoken)
      if (latex && latex.trim()) return latex
    }
  } catch {
    // ignore; fall through
  }
  return applySpokenMathFallback(spoken)
}
