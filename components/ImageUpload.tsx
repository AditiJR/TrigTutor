'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progressMsg, setProgressMsg] = useState<string>('')

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
      const previewUrl = file.size <= MAX_INLINE_PREVIEW_BYTES ? await fileToDataUrl(file) : null

      setProgressMsg('Extracting the problem…')
      const form = new FormData()
      form.append('image', file)
      const res = await fetch('/api/ocr', { method: 'POST', body: form })

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string }
        if (res.status === 429) {
          setError('Whoa — too many uploads. Wait a minute and try again.')
        } else if (errBody.error === 'image_field_required') {
          setError('Something went wrong with the upload. Try again.')
        } else if (errBody.error === 'ocr_failed') {
          setError('We couldn\u2019t read that image. Try a clearer photo, or pick a problem from the list below.')
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

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) void handleFile(f)
  }

  return (
    <div className="space-y-2">
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-8 text-center transition hover:border-blue-400"
      >
        <span className="text-sm font-medium text-slate-700">
          {busy
            ? progressMsg || 'Reading your image\u2026'
            : 'Drop a photo, or tap to choose / take one'}
        </span>
        <span className="mt-1 text-xs text-slate-500">
          PNG, JPEG, or HEIC up to 8&nbsp;MB. We&rsquo;ll show what we extracted before solving.
        </span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onChange}
          disabled={busy}
        />
      </label>
      {error && <p className="text-sm text-incorrect">{error}</p>}
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
