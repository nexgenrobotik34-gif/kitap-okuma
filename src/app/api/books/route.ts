import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { promises as fs } from "fs"
import path from "path"

export const runtime = "nodejs"

const PDF_DIR = path.join(process.cwd(), "db", "pdfs")

export async function GET() {
  const books = await db.book.findMany({
    orderBy: [{ lastReadAt: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { segments: true, highlights: true } } },
  })
  return NextResponse.json(
    books.map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      type: b.type,
      pageCount: b.pageCount,
      charCount: b.charCount,
      lastPage: b.lastPage,
      lastScroll: b.lastScroll,
      totalTimeSec: b.totalTimeSec,
      lastReadAt: b.lastReadAt,
      fileSize: b.fileSize,
      createdAt: b.createdAt,
      segmentCount: b._count.segments,
      highlightCount: b._count.highlights,
    }))
  )
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const type = String(form.get("type") ?? "")
    const title = String(form.get("title") ?? "").trim()
    const authorRaw = String(form.get("author") ?? "").trim()
    if (!title) return NextResponse.json({ error: "Kitap adı gerekli" }, { status: 400 })

    if (type === "pdf") {
      const file = form.get("file") as File | null
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: "PDF dosyası bulunamadı" }, { status: 400 })
      }
      const pageCount = parseInt(String(form.get("pageCount") ?? "0"), 10) || 0
      const buf = Buffer.from(await file.arrayBuffer())
      const book = await db.book.create({
        data: {
          title,
          author: authorRaw || null,
          type: "pdf",
          pageCount,
          fileSize: buf.length,
        },
      })
      await fs.mkdir(PDF_DIR, { recursive: true })
      await fs.writeFile(path.join(PDF_DIR, `${book.id}.pdf`), buf)
      const updated = await db.book.update({
        where: { id: book.id },
        data: { filePath: `${book.id}.pdf` },
      })
      return NextResponse.json({ id: updated.id }, { status: 201 })
    }

    if (type === "text") {
      const text = String(form.get("text") ?? "")
      if (!text.trim()) {
        return NextResponse.json({ error: "Metin boş olamaz" }, { status: 400 })
      }
      const book = await db.book.create({
        data: {
          title,
          author: authorRaw || null,
          type: "text",
          textContent: text,
          charCount: text.length,
        },
      })
      return NextResponse.json({ id: book.id }, { status: 201 })
    }

    return NextResponse.json({ error: "Geçersiz kitap türü" }, { status: 400 })
  } catch (e) {
    console.error("POST /api/books error:", e)
    return NextResponse.json({ error: "Kitap kaydedilemedi" }, { status: 500 })
  }
}
