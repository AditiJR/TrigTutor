'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ImageCaptureDialog } from '@/components/ImageCaptureDialog'
import { saveOcrHandoff } from '@/lib/ocrHandoff'
import type { OcrResult } from '@/lib/types'

const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_INLINE_PREVIEW_BYTES = 4 * 1024 * 1024

export function ImageUpload() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progressMsg, setProgressMsg] = useState('')
  const [dragging, setDragging] = useState(false)
  const [captureDialogOpen, setCaptureDialogOpen] = useState(false)

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
      const previewUrl = await previewDataUrlForHandoff(file)

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

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }
  const onDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void handleFile(f)
    e.target.value = ''
  }

  return (
    <div className="w-full flex flex-col gap-3">
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
          ${
            dragging
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
                </kbd>{' '}
                to paste a screenshot
              </p>
            </div>
          </>
        )}
      </div>

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
            onClick={() => !busy && setCaptureDialogOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-outline text-secondary hover:border-primary hover:text-primary hover:bg-primary/5 font-label text-label transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">photo_camera</span>
            Take photo
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={onFileChange}
        disabled={busy}
      />

      <ImageCaptureDialog
        open={captureDialogOpen}
        onClose={() => setCaptureDialogOpen(false)}
        onFile={(f) => void handleFile(f)}
        busy={busy}
        title="Take a photo"
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

/** Full data URL for small files; downscaled JPEG for large ones so handoff can keep a figure preview. */
async function previewDataUrlForHandoff(file: File): Promise<string | null> {
  if (file.size <= MAX_INLINE_PREVIEW_BYTES) {
    return fileToDataUrl(file)
  }
  try {
    return await downscaleImageToDataUrl(file, 960, 0.82)
  } catch {
    return null
  }
}

function downscaleImageToDataUrl(
  file: File,
  maxDimension: number,
  jpegQuality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (w <= 0 || h <= 0) {
        reject(new Error('invalid image dimensions'))
        return
      }
      const scale = Math.min(1, maxDimension / Math.max(w, h))
      w = Math.round(w * scale)
      h = Math.round(h * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('no canvas context'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', jpegQuality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('image load failed'))
    }
    img.src = objectUrl
  })
}
