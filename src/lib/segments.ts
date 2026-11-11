import type { SegmentItem } from "./types"

/** PDF: sayfa aralığına, metin: konum oranına göre içinde bulunulan segmanı bulur. */
export function findCurrentSegment(
  type: "pdf" | "text",
  segments: SegmentItem[],
  page: number,
  ratio: number
): SegmentItem | null {
  for (const s of segments) {
    if (type === "pdf") {
      if (s.startPage != null && s.endPage != null && page >= s.startPage && page <= s.endPage) return s
    } else {
      if (s.startPos != null && s.endPos != null && ratio >= s.startPos - 0.005 && ratio <= s.endPos + 0.005) return s
    }
  }
  return null
}

export function segmentRangeLabel(type: "pdf" | "text", s: SegmentItem): string {
  if (type === "pdf") {
    if (s.startPage === s.endPage) return `s. ${s.startPage}`
    return `s. ${s.startPage}–${s.endPage}`
  }
  const a = Math.round((s.startPos ?? 0) * 100)
  const b = Math.round((s.endPos ?? 0) * 100)
  return `%${a} – %${b}`
}

/** Konuma göre geçilmiş (bitmiş) segmanları döndürür. */
export function segmentsPassed(
  type: "pdf" | "text",
  segments: SegmentItem[],
  page: number,
  ratio: number
): SegmentItem[] {
  return segments.filter((s) => {
    if (s.done) return false
    if (type === "pdf") return s.endPage != null && page > s.endPage
    return s.endPos != null && ratio > s.endPos + 0.005
  })
}
