"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { loadPdfJs } from "@/lib/pdfjs"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"

export interface PdfReaderHandle {
  goToPage: (page: number, restoreRatio?: number) => void
}

interface Props {
  bookId: string
  initialPage: number
  initialRatio: number
  pageCountHint: number
  onPositionChange: (pos: { page: number; ratio: number }) => void
  onPageCount: (n: number) => void
}

interface RenderTaskLike {
  cancel: () => void
  promise: Promise<void>
}

const PdfReader = forwardRef<PdfReaderHandle, Props>(function PdfReader(
  { bookId, initialPage, initialRatio, pageCountHint, onPositionChange, onPageCount },
  ref
) {
  const [numPages, setNumPages] = useState(pageCountHint)
  const [page, setPage] = useState(() => Math.max(1, initialPage))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [docVersion, setDocVersion] = useState(0)
  const [containerW, setContainerW] = useState(0)
  const [pageInput, setPageInput] = useState(String(Math.max(1, initialPage)))

  const docRef = useRef<PDFDocumentProxy | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<RenderTaskLike | null>(null)
  const restoreRef = useRef<number | null>(initialRatio > 0.005 ? initialRatio : null)
  const pageRef = useRef(page)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadNonceRef = useRef(0)
  const [loadNonce, setLoadNonce] = useState(0)

  pageRef.current = page

  useImperativeHandle(ref, () => ({
    goToPage(n: number, restoreRatio?: number) {
      const max = numPages || n
      const clamped = Math.min(Math.max(1, Math.floor(n)), max || 1)
      restoreRef.current = restoreRatio && restoreRatio > 0.005 ? restoreRatio : null
      setPage(clamped)
      setPageInput(String(clamped))
      onPositionChange({ page: clamped, ratio: restoreRatio ?? 0 })
      const el = scrollRef.current
      if (el && !restoreRatio) el.scrollTop = 0
    },
  }))

  // PDF'i yükle
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const nonce = loadNonceRef.current
    ;(async () => {
      try {
        const pdfjs = await loadPdfJs()
        const res = await fetch(`/api/books/${bookId}/file`)
        if (!res.ok) throw new Error("PDF dosyası sunucuda bulunamadı")
        const buf = await res.arrayBuffer()
        if (cancelled || nonce !== loadNonceRef.current) return
        const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
        if (cancelled || nonce !== loadNonceRef.current) {
          void doc.destroy()
          return
        }
        docRef.current = doc
        setNumPages(doc.numPages)
        onPageCount(doc.numPages)
        setPage((p) => Math.min(Math.max(1, p), doc.numPages))
        setLoading(false)
        setDocVersion((v) => v + 1)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "PDF yüklenemedi")
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
      void docRef.current?.destroy()
      docRef.current = null
    }
  }, [bookId, loadNonce])

  // Kapsayıcı genişliği
  useEffect(() => {
    const el = measureRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setContainerW(Math.floor(w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Sayfa çizimi
  useEffect(() => {
    const doc = docRef.current
    const canvas = canvasRef.current
    if (!doc || !canvas || containerW < 50 || loading) return
    let cancelled = false
    ;(async () => {
      try {
        renderTaskRef.current?.cancel()
        const pg = await doc.getPage(page)
        if (cancelled) return
        const base = pg.getViewport({ scale: 1 })
        const targetW = Math.min(containerW - 8, base.width)
        const scale = targetW / base.width
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
        const viewport = pg.getViewport({ scale: scale * dpr })
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.style.width = `${Math.floor(base.width * scale)}px`
        canvas.style.height = `${Math.floor(base.height * scale)}px`
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        const task = pg.render({ canvasContext: ctx, viewport })
        renderTaskRef.current = task
        await task.promise
        if (cancelled) return
        const el = scrollRef.current
        if (el && restoreRef.current != null) {
          const ratio = restoreRef.current
          restoreRef.current = null
          requestAnimationFrame(() => {
            el.scrollTop = ratio * (el.scrollHeight - el.clientHeight)
          })
        }
      } catch {
        // RenderingCancelledException — yok sayılır
      }
    })()
    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
    }
  }, [page, containerW, docVersion, loading])

  const goToPage = useCallback(
    (n: number) => {
      const max = numPages || 1
      const clamped = Math.min(Math.max(1, Math.floor(n)), max)
      if (clamped === pageRef.current) return
      restoreRef.current = null
      setPage(clamped)
      setPageInput(String(clamped))
      const el = scrollRef.current
      if (el) el.scrollTop = 0
      onPositionChange({ page: clamped, ratio: 0 })
    },
    [numPages, onPositionChange]
  )

  // Kaydırma oranı takibi
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
      scrollTimer.current = setTimeout(() => {
        const max = el.scrollHeight - el.clientHeight
        const ratio = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0
        onPositionChange({ page: pageRef.current, ratio })
      }, 400)
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      el.removeEventListener("scroll", onScroll)
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
    }
  }, [docVersion, onPositionChange])

  // Klavye + swipe
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goToPage(pageRef.current + 1)
      if (e.key === "ArrowLeft") goToPage(pageRef.current - 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [goToPage])

  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current
    if (!s) return
    touchStart.current = null
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.abs(dx) > 64 && Math.abs(dx) > 2 * Math.abs(dy)) {
      if (dx < 0) goToPage(pageRef.current + 1)
      else goToPage(pageRef.current - 1)
    }
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button
          variant="outline"
          onClick={() => {
            loadNonceRef.current += 1
            setLoadNonce((n) => n + 1)
          }}
        >
          Tekrar dene
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div ref={measureRef} className="flex-1 min-h-0 relative">
        <div ref={scrollRef} className="reader-scroll h-full thin-scroll bg-muted/40">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">PDF yükleniyor…</p>
            </div>
          ) : (
            <div className="min-h-full flex items-start justify-center px-2 py-4">
              <canvas
                ref={canvasRef}
                className="pdf-page-shadow rounded-sm bg-white"
                aria-label={`Sayfa ${page}`}
              />
            </div>
          )}
        </div>
        {loading && <div className="absolute inset-0 pointer-events-none" aria-hidden="true" />}
      </div>

      {/* Sayfa gezinme çubuğu */}
      {!loading && numPages > 0 && (
        <div className="border-t bg-background/95 backdrop-blur px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-11 shrink-0"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              aria-label="Önceki sayfa"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <div className="flex-1 flex items-center gap-2">
              <Slider
                min={1}
                max={numPages}
                step={1}
                value={[page]}
                onValueChange={(v) => goToPage(v[0])}
                aria-label="Sayfa seçici"
              />
              <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-16 text-center">
                {page} / {numPages}
              </span>
            </div>
            <Input
              inputMode="numeric"
              className="w-16 h-11 text-center hidden sm:block"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const n = parseInt(pageInput, 10)
                  if (n >= 1) goToPage(n)
                }
              }}
              onBlur={() => setPageInput(String(page))}
              aria-label="Sayfa numarası yaz"
            />
            <Button
              variant="outline"
              size="icon"
              className="size-11 shrink-0"
              onClick={() => goToPage(page + 1)}
              disabled={page >= numPages}
              aria-label="Sonraki sayfa"
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
})

export default PdfReader
