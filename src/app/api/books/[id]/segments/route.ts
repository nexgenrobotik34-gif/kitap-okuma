import { NextResponse } from "next/server"
import { db } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const book = await db.book.findUnique({ where: { id }, select: { id: true, type: true } })
    if (!book) return NextResponse.json({ error: "Kitap bulunamadı" }, { status: 404 })

    const body = await request.json()
    const title = String(body.title ?? "").trim()
    if (!title) return NextResponse.json({ error: "Segman adı gerekli" }, { status: 400 })

    const count = await db.segment.count({ where: { bookId: id } })

    if (book.type === "pdf") {
      const startPage = Math.floor(Number(body.startPage))
      const endPage = Math.floor(Number(body.endPage))
      if (!startPage || !endPage || startPage < 1 || endPage < startPage) {
        return NextResponse.json({ error: "Geçersiz sayfa aralığı" }, { status: 400 })
      }
      const segment = await db.segment.create({
        data: { bookId: id, title, startPage, endPage, order: count },
      })
      return NextResponse.json(segment, { status: 201 })
    }

    const startPos = Number(body.startPos)
    const endPos = Number(body.endPos)
    if (isNaN(startPos) || isNaN(endPos) || startPos < 0 || endPos <= startPos || endPos > 1) {
      return NextResponse.json({ error: "Geçersiz konum aralığı" }, { status: 400 })
    }
    const segment = await db.segment.create({
      data: { bookId: id, title, startPos, endPos, order: count },
    })
    return NextResponse.json(segment, { status: 201 })
  } catch (e) {
    console.error("POST segments error:", e)
    return NextResponse.json({ error: "Segman kaydedilemedi" }, { status: 500 })
  }
}
