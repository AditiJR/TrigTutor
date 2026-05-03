'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { saveOcrHandoff } from '@/lib/ocrHandoff'
import type { OcrResult } from '@/lib/types'

const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_INLINE_PREVIEW_BYTES = 4 * 1024 * 1024

export function ImageUpload() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progressMsg, setProgressMsg] = useState('')
  const [dragging, setDragging] = useState(false)

  const handleFile = async (file: File) => {
    if (busyRef.current) return
    setError(null)

    if (!file.type.startsWith('image/')) {
      setError('Please use a PNG, JPEG, or WEBP image.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('That image is too large — try one under 8 MB.')
      return
    }

    busyRef.current = true
    setBusy(true)
    setProgressMsg('Reading image…')

    try {
      const previewUrl =
        file.size <= MAX_INLINE_PREVIEW_BYTES ? await fileToDataUrl(file) : null

      setProgressMsg('Extracting the problem…')
      const form = new FormData()
      form.append('image', file)
      const res = await fetch('/api/ocr', { method: 'POST', body: form })

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string }
        if (res.status === 429) {
          setError('Too many uploads — wait a minute and try again.')
        } else if (errBody.error === 'ocr_failed') {
          setError("Couldn't read that image. Try a clearer photo.")
        } else {
          setError(`Upload failed (HTTP ${res.status}). Try again.`)
        }
        return
      }

      const data = (await res.json()) as OcrResult
      const handoff = saveOcrHandoff(data, previewUrl)
      router.push(`/confirm-ocr?id=${encodeURIComponent(handoff.id)}`)
    } catch (err) {
      console.error('[ImageUpload]', err)
      setError('Something went wrong. Please try again.')
    } finally {
      busyRef.current = false
      setBusy(false)
      setProgressMsg('')
    }
  }

  // Paste from clipboard (Ctrl/Cmd+V anywhere on the page)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (busyRef.current) return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            void handleFile(file)
            break
          }
        }
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) void handleFile(f)
  }

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = (e: React.DragEvent) => {
    // only clear when leaving the drop zone entirely, not child elements
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void handleFile(f)
    e.target.value = ''
  }

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !busy && fileInputRef.current?.click()}
        role="button"
        tabIndex={busy ? -1 : 0}
        onKeyDown={(e) => e.key === 'Enter' && !busy && fileInputRef.current?.click()}
        aria-label="Upload problem image"
        className={`
          relative rounded-xl border-2 border-dashed transition-all cursor-pointer select-none
          flex flex-col items-center justify-center gap-3 px-6 py-8 text-center
          ${dragging
            ? 'border-primary bg-primary/8 scale-[1.01]'
            : busy
              ? 'border-outline-variant bg-surface-container-low cursor-not-allowed opacity-70'
              : 'border-outline-variant hover:border-primary hover:bg-primary/5'
          }
        `}
      >
        {busy ? (
          <>
            <span className="material-symbols-outlined text-4xl text-primary animate-pulse">
              hourglass_empty
            </span>
            <p className="font-body text-body text-secondary">{progressMsg || 'Working…'}</p>
          </>
        ) : dragging ? (
          <>
            <span className="material-symbols-outlined text-4xl text-primary">download</span>
            <p className="font-body font-semibold text-primary">Drop it here</p>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-4xl text-secondary">
              add_photo_alternate
            </span>
            <div>
              <p className="font-body text-body text-on-surface font-medium">
                Drop image here or click to browse
              </p>
              <p className="font-body-sm text-body-sm text-secondary mt-1">
                Or press{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-surface-container border border-outline-variant font-mono text-xs">
                  Ctrl+V
                </kbd>
                {' '}to paste a screenshot
              </p>
            </div>
          </>
        )}
      </div>

      {/* Action buttons row */}
      {!busy && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-outline text-secondary hover:border-primary hover:text-primary hover:bg-primary/5 font-label text-label transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">folder_open</span>
            Browse files
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-outline text-secondary hover:border-primary hover:text-primary hover:bg-primary/5 font-label text-label transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">photo_camera</span>
            Take photo
          </button>
        </div>
      )}

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={onFileChange}
        disabled={busy}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={onFileChange}
        disabled={busy}
      />

      {error && (
        <p className="text-body-sm font-body-sm text-incorrect flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">error</span>
          {error}
        </p>
      )}
    </div>
  )
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
