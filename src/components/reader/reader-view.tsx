"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { api } from "@/lib/api"
import { computeProgress, formatDuration } from "@/lib/types"
import { findCurrentSegment, segmentsPassed } from "@/lib/segments"
import type {
  BookDetail,
  HighlightItem,
  PositionUpdate,
  ReadingTheme,
  SegmentItem,
} from "@/lib/types"
import TextReader, { type SelectionInfo, type TextReaderHandle } from "./text-reader"
import PdfReader, { type PdfReaderHandle } from "./pdf-reader"
import { SegmentsSheet } from "./segments-sheet"
import { NotesSheet } from "./notes-sheet"
import {
  ArrowLeft,
  Flag,
  Highlighter,
  ListTree,
  Loader2,
  Moon,
  StickyNote,
  Sun,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  bookId: string
  theme: ReadingTheme
  onThemeChange: (t: ReadingTheme) => void
  onExit: () => void
  onLibraryRefresh: () => void
}

type NoteDialogState = {
  excerpt: string
  startChar?: number
  endChar?: number
  page?: number
} | null

export function ReaderView({ bookId, theme, onThemeChange, onExit, onLibraryRefresh }: Props) {
  const { toast } = useToast()
  const [book, setBook] = useState<BookDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [ratio, setRatio] = useState(0)
  const [highlights, setHighlights] = useState<HighlightItem[]>([])
  const [pendingStart, setPendingStart] = useState<number | null>(null)

  const [segmentsOpen, setSegmentsOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [noteDialog, setNoteDialog] = useState<NoteDialogState>(null)
  const [noteText, setNoteText] = useState("")
  const [noteColor, setNoteColor] = useState("yellow")

  const textRef = useRef<TextReaderHandle>(null)
  const pdfRef = useRef<PdfReaderHandle>(null)
  const posTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestPos = useRef<PositionUpdate>({})
  const exitRef = useRef(false)

  // Kitabı yükle
  useEffect(() => {
    let cancelled = false
    exitRef.current = false
    api
      .getBook(bookId)
      .then((b) => {
        if (cancelled) return
        setBook(b)
        setHighlights(b.highlights)
        setPage(Math.max(1, b.lastPage))
        setRatio(b.lastScroll)
        latestPos.current = b.type === "pdf" ? { lastPage: Math.max(1, b.lastPage), lastScroll: b.lastScroll } : { lastScroll: b.lastScroll }
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Kitap yüklenemedi"))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [bookId])

  // Okuma süresi sayacı
  useEffect(() => {
    let acc = 0
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") acc += 1
      if (acc >= 15) {
        const delta = acc
        acc = 0
        api.updateBook(bookId, { timeDelta: delta }).catch(() => {})
        setBook((b) => (b ? { ...b, totalTimeSec: b.totalTimeSec + delta } : b))
      }
    }, 1000)
    const flushAcc = () => {
      if (acc > 0) {
        api.updateBook(bookId, { timeDelta: acc }).catch(() => {})
        acc = 0
      }
    }
    document.addEventListener("visibilitychange", flushAcc)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", flushAcc)
      flushAcc()
    }
  }, [bookId])

  const bookRef = useRef<BookDetail | null>(null)
  useEffect(() => {
    bookRef.current = book
  }, [book])

  const savePosition = useCallback(
    (patch: PositionUpdate) => {
      latestPos.current = { ...latestPos.current, ...patch }
      if (posTimer.current) clearTimeout(posTimer.current)
      posTimer.current = setTimeout(async () => {
        try {
          await api.updateBook(bookId, latestPos.current)
          const b = bookRef.current
          if (!b) return
          const passed = segmentsPassed(
            b.type as "pdf" | "text",
            b.segments,
            latestPos.current.lastPage ?? b.lastPage,
            latestPos.current.lastScroll ?? b.lastScroll
          )
          if (passed.length > 0) {
            await Promise.allSettled(passed.map((s) => api.updateSegment(s.id, { done: true })))
            setBook((cur) =>
              cur
                ? {
                    ...cur,
                    segments: cur.segments.map((s) =>
                      passed.some((p) => p.id === s.id) ? { ...s, done: true } : s
                    ),
                  }
                : cur
            )
          }
        } catch {
          // sessizce geç
        }
      }, 800)
    },
    [bookId]
  )

  const flushPosition = useCallback(() => {
    if (posTimer.current) {
      clearTimeout(posTimer.current)
      posTimer.current = null
      if (Object.keys(latestPos.current).length > 0) {
        // keepalive ile kapanmadan önce gönder
        fetch(`/api/books/${bookId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(latestPos.current),
          keepalive: true,
        }).catch(() => {})
      }
    }
  }, [bookId])

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushPosition()
    }
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", flushPosition)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", flushPosition)
    }
  }, [flushPosition])

  const handleTextPosition = useCallback(
    (r: number) => {
      setRatio(r)
      setBook((b) => (b ? { ...b, lastScroll: r } : b))
      savePosition({ lastScroll: r })
    },
    [savePosition]
  )

  const handlePdfPosition = useCallback(
    (pos: { page: number; ratio: number }) => {
      setPage(pos.page)
      setRatio(pos.ratio)
      setBook((b) => (b ? { ...b, lastPage: pos.page, lastScroll: pos.ratio } : b))
      savePosition({ lastPage: pos.page, lastScroll: pos.ratio })
    },
    [savePosition]
  )

  const handlePageCount = useCallback(
    (n: number) => {
      setBook((b) => {
        if (!b) return b
        if (b.pageCount !== n) {
          api.updateBook(b.id, { pageCount: n }).catch(() => {})
          return { ...b, pageCount: n }
        }
        return b
      })
    },
    []
  )

  const progressPct = useMemo(() => {
    if (!book) return 0
    return computeProgress({ ...book, lastPage: page, lastScroll: ratio })
  }, [book, page, ratio])

  const currentSegment = useMemo(() => {
    if (!book) return null
    return findCurrentSegment(book.type as "pdf" | "text", book.segments, page, ratio)
  }, [book, page, ratio])

  const handleExit = () => {
    exitRef.current = true
    flushPosition()
    onLibraryRefresh()
    onExit()
  }

  // Vurgu oluşturma
  const createHighlight = async (data: {
    excerpt?: string
    startChar?: number
    endChar?: number
    page?: number
    note?: string
    color?: string
  }) => {
    try {
      const h = await api.createHighlight(bookId, data)
      setHighlights((prev) => [h, ...prev])
      toast({ title: data.note ? "Not eklendi" : "Vurgu eklendi" })
    } catch (e) {
      toast({
        title: "Kaydedilemedi",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    }
  }

  const onHighlightColor = (sel: SelectionInfo, color: string) => {
    createHighlight({ excerpt: sel.excerpt, startChar: sel.startChar, endChar: sel.endChar, color })
  }

  const onHighlightNote = (sel: SelectionInfo) => {
    setNoteText("")
    setNoteColor("yellow")
    setNoteDialog({ excerpt: sel.excerpt, startChar: sel.startChar, endChar: sel.endChar })
  }

  const onPdfPageNote = () => {
    setNoteText("")
    setNoteColor("yellow")
    setNoteDialog({ excerpt: "", page })
  }

  const saveNoteDialog = async () => {
    if (!noteDialog) return
    await createHighlight({
      excerpt: noteDialog.excerpt,
      startChar: noteDialog.startChar,
      endChar: noteDialog.endChar,
      page: noteDialog.page,
      note: noteText.trim() || undefined,
      color: noteColor,
    })
    setNoteDialog(null)
  }

  const jumpToHighlight = (h: HighlightItem) => {
    setNotesOpen(false)
    if (book?.type === "pdf" && h.page != null) {
      pdfRef.current?.goToPage(h.page, 0)
    } else if (h.startChar != null && book && book.charCount > 0) {
      textRef.current?.scrollToRatio(Math.min(1, h.startChar / book.charCount))
    }
  }

  const jumpToSegment = (s: SegmentItem) => {
    setSegmentsOpen(false)
    if (book?.type === "pdf" && s.startPage != null) {
      pdfRef.current?.goToPage(s.startPage, 0)
    } else if (s.startPos != null) {
      textRef.current?.scrollToRatio(s.startPos)
    }
  }

  const toggleTheme = () => {
    onThemeChange(theme === "dark" ? "light" : "dark")
  }

  const ThemeIcon = theme === "dark" ? Moon : Sun

  const bottomButtons = book?.type === "pdf"
    ? [
        {
          key: "pagenote",
          icon: StickyNote,
          label: "Sayfa notu",
          onClick: onPdfPageNote,
        },
        {
          key: "segments",
          icon: ListTree,
          label: `Segmanlar${book?.segments.length ? ` (${book.segments.length})` : ""}`,
          onClick: () => setSegmentsOpen(true),
        },
        {
          key: "notes",
          icon: Highlighter,
          label: `Notlar${highlights.length ? ` (${highlights.length})` : ""}`,
          onClick: () => setNotesOpen(true),
        },
      ]
    : [
        {
          key: "segstart",
          icon: Flag,
          label: "Segman başlangıcı",
          onClick: () => {
            const r = Math.round(ratio * 1000) / 1000
            setPendingStart(r)
            toast({ title: `Segman başlangıcı işaretlendi (%${Math.round(r * 100)})` })
          },
          active: pendingStart != null,
        },
        {
          key: "segments",
          icon: ListTree,
          label: `Segmanlar${book?.segments.length ? ` (${book.segments.length})` : ""}`,
          onClick: () => setSegmentsOpen(true),
        },
        {
          key: "notes",
          icon: Highlighter,
          label: `Notlar${highlights.length ? ` (${highlights.length})` : ""}`,
          onClick: () => setNotesOpen(true),
        },
      ]

  if (loading) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Kitap açılıyor…</p>
      </div>
    )
  }

  if (error || !book) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-background gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">{error || "Kitap bulunamadı"}</p>
        <Button variant="outline" onClick={handleExit}>
          Kütüphaneye dön
        </Button>
      </div>
    )
  }

  const totalInfo =
    book.type === "pdf"
      ? `${book.pageCount} sayfa · ${formatDuration(book.totalTimeSec)} okundu`
      : `${book.charCount.toLocaleString("tr-TR")} karakter · ${formatDuration(book.totalTimeSec)} okundu`

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      {/* Üst çubuk */}
      <header className="shrink-0 border-b bg-background/95 backdrop-blur z-20">
        <div className="flex items-center gap-1 px-2 h-14">
          <Button variant="ghost" size="icon" className="size-11 shrink-0" onClick={handleExit} aria-label="Kütüphaneye dön">
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate text-sm">{book.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              %{Math.round(progressPct)}
              {currentSegment ? ` · ${currentSegment.title}` : ""} · {totalInfo}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="size-11 shrink-0" onClick={toggleTheme} aria-label="Temayı değiştir" title={theme === "dark" ? "Gündüz modu" : "Gece modu"}>
            <ThemeIcon className="size-5" />
          </Button>
        </div>
        <Progress value={progressPct} className="h-1 rounded-none bg-muted" />
      </header>

      {/* İçerik */}
      <main className="flex-1 min-h-0 relative">
        {book.type === "text" && book.textContent ? (
          <TextReader
            ref={textRef}
            text={book.textContent}
            highlights={highlights}
            initialRatio={ratio}
            onPositionChange={handleTextPosition}
            onHighlightColor={onHighlightColor}
            onHighlightNote={onHighlightNote}
          />
        ) : book.type === "pdf" ? (
          <PdfReader
            ref={pdfRef}
            bookId={book.id}
            initialPage={book.lastPage}
            initialRatio={book.lastScroll}
            pageCountHint={book.pageCount}
            onPositionChange={handlePdfPosition}
            onPageCount={handlePageCount}
          />
        ) : (
          <div className="h-full flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Bu kitabın metni boş görünüyor.
          </div>
        )}
      </main>

      {/* Alt çubuk */}
      <footer className="shrink-0 border-t bg-background z-20">
        {pendingStart != null && book.type === "text" && (
          <div className="flex items-center gap-2 px-3 pt-2">
            <span className="text-xs bg-primary/10 text-primary rounded-full px-2.5 py-1">
              Başlangıç: %{Math.round(pendingStart * 100)}
            </span>
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2"
              onClick={() => setPendingStart(null)}
            >
              temizle
            </button>
          </div>
        )}
        <nav
          className="flex items-stretch justify-around px-1 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
          aria-label="Okuma araçları"
        >
          {bottomButtons.map((b) => {
            const Icon = b.icon
            return (
              <button
                key={b.key}
                type="button"
                onClick={b.onClick}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 min-h-[52px] min-w-[64px] justify-center transition-colors hover:bg-accent active:bg-accent",
                  "active" in b && b.active ? "text-primary bg-primary/5" : "text-foreground"
                )}
              >
                <Icon className="size-5" />
                <span className="text-[10px] leading-tight text-center">{b.label}</span>
              </button>
            )
          })}
        </nav>
      </footer>

      {/* Segmanlar sayfası */}
      {segmentsOpen && book && (
        <SegmentsSheet
          open={segmentsOpen}
          onOpenChange={setSegmentsOpen}
          book={book}
          segments={book.segments}
          currentSegmentId={currentSegment?.id ?? null}
          progress={progressPct}
          pendingStart={pendingStart}
          currentPosition={{ page, ratio }}
          onJump={jumpToSegment}
          onSegmentChanged={(s) =>
            setBook((b) => (b ? { ...b, segments: b.segments.map((x) => (x.id === s.id ? s : x)) } : b))
          }
          onSegmentDeleted={(id) =>
            setBook((b) => (b ? { ...b, segments: b.segments.filter((x) => x.id !== id) } : b))
          }
          onSegmentCreated={(s) => {
            setBook((b) => (b ? { ...b, segments: [...b.segments, s] } : b))
            setPendingStart(null)
          }}
        />
      )}

      {/* Notlar sayfası */}
      <NotesSheet
        open={notesOpen}
        onOpenChange={setNotesOpen}
        book={book}
        highlights={highlights}
        onJump={jumpToHighlight}
        onHighlightChanged={(h) => setHighlights((prev) => prev.map((x) => (x.id === h.id ? h : x)))}
        onHighlightDeleted={(id) => setHighlights((prev) => prev.filter((x) => x.id !== id))}
      />

      {/* Not ekleme diyaloğu */}
      {noteDialog && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-background p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                {noteDialog.page != null ? `Sayfa ${noteDialog.page} notu` : "Not ekle"}
              </h3>
              <Button variant="ghost" size="icon" className="size-9" onClick={() => setNoteDialog(null)} aria-label="Kapat">
                <X className="size-4" />
              </Button>
            </div>
            {noteDialog.excerpt && (
              <p className="text-sm italic text-muted-foreground border-l-2 border-primary/40 pl-3 line-clamp-4">
                “{noteDialog.excerpt}”
              </p>
            )}
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Düşüncelerini yaz… (isteğe bağlı)"
              rows={4}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Renk:</span>
              {[
                { color: "yellow", cls: "bg-[rgba(245,190,40,0.9)]", label: "Sarı" },
                { color: "green", cls: "bg-[rgba(74,190,120,0.9)]", label: "Yeşil" },
                { color: "rose", cls: "bg-[rgba(235,100,130,0.9)]", label: "Pembe" },
              ].map((c) => (
                <button
                  key={c.color}
                  type="button"
                  aria-label={c.label}
                  onClick={() => setNoteColor(c.color)}
                  className={cn(
                    "size-8 rounded-full border-2 transition-transform active:scale-90",
                    c.cls,
                    noteColor === c.color ? "border-foreground scale-110" : "border-transparent"
                  )}
                />
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 h-11" onClick={() => setNoteDialog(null)}>
                Vazgeç
              </Button>
              <Button className="flex-1 h-11" onClick={saveNoteDialog}>
                Kaydet
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
