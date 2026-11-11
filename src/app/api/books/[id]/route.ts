import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { promises as fs } from "fs"
import path from "path"

export const runtime = "nodejs"

const PDF_DIR = path.join(process.cwd(), "db", "pdfs")

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const book = await db.book.findUnique({
    where: { id },
    include: {
      segments: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      highlights: { orderBy: { createdAt: "desc" } },
    },
  })
  if (!book) return NextResponse.json({ error: "Kitap bulunamadı" }, { status: 404 })
  return NextResponse.json({
    id: book.id,
    title: book.title,
    author: book.author,
    type: book.type,
    pageCount: book.pageCount,
    charCount: book.charCount,
    textContent: book.textContent,
    filePath: book.filePath,
    fileSize: book.fileSize,
    lastPage: book.lastPage,
    lastScroll: book.lastScroll,
    totalTimeSec: book.totalTimeSec,
    lastReadAt: book.lastReadAt,
    createdAt: book.createdAt,
    segmentCount: book.segments.length,
    highlightCount: book.highlights.length,
    segments: book.segments,
    highlights: book.highlights,
  })
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim()
    if (typeof body.author === "string") data.author = body.author.trim() || null
    if (typeof body.lastPage === "number" && body.lastPage >= 1) data.lastPage = Math.floor(body.lastPage)
    if (typeof body.lastScroll === "number" && body.lastScroll >= 0 && body.lastScroll <= 1) {
      data.lastScroll = body.lastScroll
    }
    if (typeof body.pageCount === "number" && body.pageCount > 0) data.pageCount = Math.floor(body.pageCount)
    if (typeof body.timeDelta === "number" && body.timeDelta > 0) {
      data.totalTimeSec = { increment: Math.floor(body.timeDelta) }
    }
    if (typeof body.lastPage === "number" || typeof body.lastScroll === "number" || typeof body.timeDelta === "number") {
      data.lastReadAt = new Date()
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 })
    }
    try {
      await db.book.update({ where: { id }, data })
      return NextResponse.json({ ok: true })
    } catch (err) {
      // Kitap bu arada silinmişse (P2025) sessizce onayla — konum zaten gidemez
      if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2025") {
        return NextResponse.json({ ok: true, deleted: true })
      }
      throw err
    }
  } catch (e) {
    console.error("PATCH /api/books/[id] error:", e)
    return NextResponse.json({ error: "Güncelleme başarısız" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const book = await db.book.findUnique({ where: { id } })
  if (!book) return NextResponse.json({ error: "Kitap bulunamadı" }, { status: 404 })
  if (book.filePath) {
    try {
      await fs.unlink(path.join(PDF_DIR, book.filePath))
    } catch {
      // dosya zaten yoksa sorun değil
    }
  }
  await db.book.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
