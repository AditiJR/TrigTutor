'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { saveOcrHandoff } from '@/lib/ocrHandoff'
import type { OcrResult } from '@/lib/types'

const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_INLINE_PREVIEW_BYTES = 4 * 1024 * 1024

/**
 * Drag/drop or camera-capture image upload. POSTs to /api/ocr and hands off the
 * result via sessionStorage so the confirm-ocr page can show the original image
 * alongside the extracted LaTeX without choking on a multi-megabyte URL.
 */
export function ImageUpload() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progressMsg, setProgressMsg] = useState<string>('')
  const [dragging, setDragging] = useState(false)

  const handleFile = async (file: File) => {
    setError(null)

    if (!file.type.startsWith('image/')) {
      setError('Please drop an image file (PNG, JPEG, or HEIC).')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('That image is too large. Try one under 8 MB.')
      return
    }

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
          setError('Too many uploads. Wait a minute and try again.')
        } else if (errBody.error === 'image_field_required') {
          setError('Something went wrong with the upload. Try again.')
        } else if (errBody.error === 'ocr_failed') {
          setError(
            "We couldn\u2019t read that image. Try a clearer photo, or pick a problem from the list below."
          )
        } else {
          setError(`Upload failed (HTTP ${res.status}). Try again.`)
        }
        return
      }

      const data = (await res.json()) as OcrResult
      const handoff = saveOcrHandoff(data, previewUrl)
      router.push(`/confirm-ocr?id=${encodeURIComponent(handoff.id)}`)
    } catch (err) {
      console.error('[ImageUpload] failed:', err)
      setError('Sorry, something went wrong reading that image. Try again.')
    } finally {
      setBusy(false)
      setProgressMsg('')
    }
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void handleFile(f)
    e.target.value = ''
  }

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

  const onDragLeave = () => setDragging(false)

  return (
    <div className="w-full">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`transition-colors ${dragging ? 'bg-primary-fixed/20' : ''}`}
      >
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="bg-primary hover:bg-primary/90 text-on-primary font-label text-label px-6 py-3 rounded-lg transition-colors shadow-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy ? (
            <>
              <span className="material-symbols-outlined text-sm animate-pulse">
                hourglass_empty
              </span>
              {progressMsg || 'Working…'}
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm">image</span>
              Select File
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onChange}
          disabled={busy}
        />
      </div>
      {error && (
        <p className="mt-3 text-body-sm font-body-sm text-incorrect">{error}</p>
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
