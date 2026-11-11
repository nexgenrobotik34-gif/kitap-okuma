export type BookType = "pdf" | "text"

export interface BookListItem {
  id: string
  title: string
  author: string | null
  type: BookType
  pageCount: number
  charCount: number
  lastPage: number
  lastScroll: number
  totalTimeSec: number
  lastReadAt: string | null
  fileSize: number
  createdAt: string
  segmentCount: number
  highlightCount: number
}

export interface BookDetail extends BookListItem {
  textContent: string | null
  filePath: string | null
  segments: SegmentItem[]
  highlights: HighlightItem[]
}

export interface SegmentItem {
  id: string
  bookId: string
  title: string
  startPage: number | null
  endPage: number | null
  startPos: number | null
  endPos: number | null
  done: boolean
  order: number
}

export interface HighlightItem {
  id: string
  bookId: string
  page: number | null
  startChar: number | null
  endChar: number | null
  excerpt: string
  note: string | null
  color: string
  createdAt: string
}

export type ReadingTheme = "light" | "dark"

export interface AppSettingsData {
  theme: ReadingTheme
}

/** Sabit rahat okuma değerleri (ayar menüsü yok) */
export const READING = {
  fontSize: 19,
  lineHeight: 1.85,
  pageWidth: 680,
} as const

export interface PositionUpdate {
  lastPage?: number
  lastScroll?: number
  timeDelta?: number
  pageCount?: number
}

export function computeProgress(book: Pick<BookListItem, "type" | "pageCount" | "lastPage" | "lastScroll">): number {
  if (book.type === "pdf") {
    if (!book.pageCount || book.pageCount <= 0) return 0
    const p = ((book.lastPage - 1 + book.lastScroll) / book.pageCount) * 100
    return Math.min(100, Math.max(0, p))
  }
  return Math.min(100, Math.max(0, book.lastScroll * 100))
}

export function formatDuration(totalSec: number): string {
  if (totalSec < 60) return `${totalSec} sn`
  const min = Math.floor(totalSec / 60)
  if (min < 60) return `${min} dk`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h} sa ${m} dk` : `${h} sa`
}
