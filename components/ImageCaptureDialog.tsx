'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type ImageCaptureDialogProps = {
  open: boolean
  onClose: () => void
  /** Invoked with a camera frame or a picked file. Parent runs OCR / upload. */
  onFile: (file: File) => void
  /** Disables capture / upload buttons while parent is working. */
  busy?: boolean
  /** Dialog title (e.g. problem upload vs step photo). */
  title?: string
}

/**
 * Modal with live camera preview, capture, and fallback file upload.
 * Shared by home problem upload and solve-page handwritten step capture.
 */
export function ImageCaptureDialog({
  open,
  onClose,
  onFile,
  busy = false,
  title = 'Take a photo'
}: ImageCaptureDialogProps) {
  const dialogFileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    const v = videoRef.current
    if (v) v.srcObject = null
    setCameraReady(false)
    setCameraError(null)
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setCameraReady(false)
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera is not supported in this browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      })
      streamRef.current = stream
      const v = videoRef.current
      if (v) {
        v.srcObject = stream
        await v.play().catch(() => {})
      }
      setCameraReady(true)
    } catch {
      setCameraError('Could not access the camera. Check permissions or use file upload below.')
    }
  }, [])

  useEffect(() => {
    if (!open) {
      stopCamera()
      return
    }
    void startCamera()
    return () => {
      stopCamera()
    }
  }, [open, startCamera, stopCamera])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const deliverFile = (file: File) => {
    onClose()
    onFile(file)
  }

  const captureFromVideo = () => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (blob) {
          deliverFile(new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' }))
        }
      },
      'image/jpeg',
      0.92
    )
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-capture-dialog-title"
        className="w-full max-w-lg max-h-[90vh] flex flex-col bg-surface rounded-2xl shadow-xl border border-border-subtle overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0">
          <h2 id="image-capture-dialog-title" className="font-h2 text-h2 text-on-surface">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            disabled={busy}
            className="w-11 h-11 flex items-center justify-center rounded-full text-secondary hover:bg-surface-container transition-colors disabled:opacity-40"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="relative bg-black aspect-video w-full shrink-0">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6">
              <p className="font-body text-body text-center text-white/90">{cameraError}</p>
            </div>
          )}
        </div>

        <div className="p-4 flex flex-col gap-3 border-t border-border-subtle">
          <button
            type="button"
            onClick={captureFromVideo}
            disabled={!cameraReady || busy}
            className="w-full py-3 rounded-lg bg-primary text-on-primary font-label text-label flex items-center justify-center gap-2 shadow-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">camera</span>
            Capture photo
          </button>

          <input
            ref={dialogFileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) deliverFile(f)
            }}
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => dialogFileInputRef.current?.click()}
            disabled={busy}
            className="w-full py-3 rounded-lg border border-outline text-on-surface font-label text-label flex items-center justify-center gap-2 hover:bg-surface-container transition-colors disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[20px]">upload_file</span>
            Upload a file instead
          </button>
        </div>
      </div>
    </div>
  )
}
