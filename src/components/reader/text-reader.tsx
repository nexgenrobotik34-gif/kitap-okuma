"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import { READING, type HighlightItem } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface SelectionInfo {
  startChar: number
  endChar: number
  excerpt: string
}

interface SelState extends SelectionInfo {
  top: number
  left: number
}

export interface TextReaderHandle {
  scrollToRatio: (ratio: number) => void
}

interface Props {
  text: string
  highlights: HighlightItem[]
  initialRatio: number
  onPositionChange: (ratio: number) => void
  onHighlightColor: (sel: SelectionInfo, color: string) => void
  onHighlightNote: (sel: SelectionInfo) => void
}

interface Part {
  text: string
  color?: string
  id?: string
}

function partsForRange(
  text: string,
  start: number,
  end: number,
  hls: { startChar: number; endChar: number; color: string; id: string }[]
): Part[] {
  const pts = new Set<number>([start, end])
  for (const h of hls) {
    const hs = Math.max(start, Math.min(end, h.startChar))
    const he = Math.max(start, Math.min(end, h.endChar))
    if (he > hs) {
      pts.add(hs)
      pts.add(he)
    }
  }
  const sorted = Array.from(pts).sort((a, b) => a - b)
  const parts: Part[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const s = sorted[i]
    const e = sorted[i + 1]
    if (e <= s) continue
    const covering = hls.filter((h) => h.startChar <= s && h.endChar >= e)
    if (covering.length > 0) {
      const top = covering[covering.length - 1]
      parts.push({ text: text.slice(s, e), color: top.color, id: `${top.id}-${s}` })
    } else {
      parts.push({ text: text.slice(s, e), id: `t-${s}` })
    }
  }
  return parts
}

function getCharOffset(root: HTMLElement, node: Node, offset: number): number {
  let total = 0
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  while (current) {
    if (current === node) return total + offset
    total += current.textContent?.length ?? 0
    current = walker.nextNode()
  }
  return -1
}

const CHUNK_SIZE = 1600

const TextReader = forwardRef<TextReaderHandle, Props>(function TextReader(
  { text, highlights, initialRatio, onPositionChange, onHighlightColor, onHighlightNote },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selInfo, setSelInfo] = useState<SelState | null>(null)

  const textHls = useMemo(
    () =>
      highlights
        .filter((h) => h.startChar != null && h.endChar != null && h.endChar > (h.startChar ?? 0))
        .map((h) => ({ startChar: h.startChar as number, endChar: h.endChar as number, color: h.color, id: h.id }))
        .sort((a, b) => a.startChar - b.startChar),
    [highlights]
  )

  const chunks = useMemo(() => {
    const out: { text: string; start: number }[] = []
    let i = 0
    while (i < text.length) {
      let end = Math.min(text.length, i + CHUNK_SIZE)
      if (end < text.length) {
        const slice = text.slice(i, end)
        const brk = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf(" "))
        if (brk > CHUNK_SIZE - 400) end = i + brk + 1
      }
      out.push({ text: text.slice(i, end), start: i })
      i = end
    }
    return out
  }, [text])

  useImperativeHandle(ref, () => ({
    scrollToRatio(ratio: number) {
      const el = containerRef.current
      if (!el) return
      el.scrollTop = ratio * (el.scrollHeight - el.clientHeight)
    },
  }))

  // İlk açılışta kaldığı yere dön (kullanıcı kaydırırsa iptal et)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let cancelled = false
    const jump = () => {
      if (!cancelled) {
        el.scrollTop = initialRatio * (el.scrollHeight - el.clientHeight)
      }
    }
    requestAnimationFrame(jump)
    const t = setTimeout(jump, 800)
    const cancel = () => {
      cancelled = true
    }
    el.addEventListener("wheel", cancel, { passive: true })
    el.addEventListener("touchstart", cancel, { passive: true })
    el.addEventListener("keydown", cancel, { passive: true })
    return () => {
      clearTimeout(t)
      cancelled = true
      el.removeEventListener("wheel", cancel)
      el.removeEventListener("touchstart", cancel)
      el.removeEventListener("keydown", cancel)
    }

  }, [])

  // Seçim ve kaydırma takibi
  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    const readSelection = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelInfo(null)
        return
      }
      const range = sel.getRangeAt(0)
      if (!root.contains(range.commonAncestorContainer)) {
        setSelInfo(null)
        return
      }
      const textSel = sel.toString()
      if (textSel.trim().length < 2) {
        setSelInfo(null)
        return
      }
      const startChar = getCharOffset(root, range.startContainer, range.startOffset)
      const endChar = getCharOffset(root, range.endContainer, range.endOffset)
      if (startChar < 0 || endChar < 0 || endChar <= startChar) {
        setSelInfo(null)
        return
      }
      const rect = range.getBoundingClientRect()
      const cRect = root.getBoundingClientRect()
      const top = rect.top - cRect.top - 52
      const placeBelow = top < 8
      setSelInfo({
        startChar,
        endChar,
        excerpt: textSel.slice(0, 500),
        top: placeBelow ? rect.bottom - cRect.top + 10 : Math.max(8, top),
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 250)),
      })
    }

    const onMouseUp = () => setTimeout(readSelection, 10)
    const onTouchEnd = () => setTimeout(readSelection, 250)
    const onScroll = () => {
      setSelInfo(null)
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
      const el = containerRef.current
      if (!el) return
      scrollTimer.current = setTimeout(() => {
        const max = el.scrollHeight - el.clientHeight
        onPositionChange(max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0)
      }, 400)
    }

    document.addEventListener("mouseup", onMouseUp)
    document.addEventListener("touchend", onTouchEnd)
    root.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      document.removeEventListener("mouseup", onMouseUp)
      document.removeEventListener("touchend", onTouchEnd)
      root.removeEventListener("scroll", onScroll)
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
    }
  }, [onPositionChange])

  const hideToolbar = useCallback(() => {
    window.getSelection()?.removeAllRanges()
    setSelInfo(null)
  }, [])

  return (
    <div className="relative h-full min-h-0">
      <div
        ref={containerRef}
        className="reader-scroll h-full thin-scroll"
        aria-label="Kitap metni"
      >
        <div
          className="mx-auto px-4 sm:px-6 py-6 pb-24"
          style={{ maxWidth: READING.pageWidth }}
        >
          <div
            className="reader-body"
            style={{ fontSize: READING.fontSize, lineHeight: READING.lineHeight }}
          >
            {chunks.map((chunk) => {
              const parts = partsForRange(text, chunk.start, chunk.start + chunk.text.length, textHls)
              return (
                <div key={chunk.start}>
                  {parts.map((p) =>
                    p.color ? (
                      <mark key={p.id} className={cn("hl", `hl-${p.color}`)}>
                        {p.text}
                      </mark>
                    ) : (
                      <span key={p.id}>{p.text}</span>
                    )
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Seçim araç çubuğu */}
      {selInfo && (
        <div
          className="absolute z-30 flex items-center gap-1 rounded-xl border bg-popover text-popover-foreground shadow-lg px-2 py-1.5"
          style={selInfo ? { top: selInfo.top, left: selInfo.left } : undefined}
          role="toolbar"
          aria-label="Vurgu araçları"
        >
          {[
            { color: "yellow", cls: "bg-[rgba(245,190,40,0.75)]", label: "Sarı vurgu" },
            { color: "green", cls: "bg-[rgba(74,190,120,0.75)]", label: "Yeşil vurgu" },
            { color: "rose", cls: "bg-[rgba(235,100,130,0.75)]", label: "Pembe vurgu" },
          ].map((c) => (
            <button
              key={c.color}
              type="button"
              aria-label={c.label}
              title={c.label}
              className={cn("size-8 rounded-full border border-black/10 active:scale-90 transition-transform", c.cls)}
              onClick={() => {
                onHighlightColor(
                  { startChar: selInfo.startChar, endChar: selInfo.endChar, excerpt: selInfo.excerpt },
                  c.color
                )
                hideToolbar()
              }}
            />
          ))}
          <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
          <button
            type="button"
            className="h-8 rounded-lg px-3 text-sm font-medium hover:bg-accent active:scale-95 transition-transform"
            onClick={() => {
              onHighlightNote({ startChar: selInfo.startChar, endChar: selInfo.endChar, excerpt: selInfo.excerpt })
              hideToolbar()
            }}
          >
            Not ekle
          </button>
        </div>
      )}
    </div>
  )
})

export default TextReader
