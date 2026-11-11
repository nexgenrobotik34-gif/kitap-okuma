import { NextResponse } from "next/server"
import { db } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const data: Record<string, unknown> = {
      bookId: id,
      color: ["yellow", "green", "rose"].includes(body.color) ? body.color : "yellow",
    }

    if (typeof body.page === "number" && body.page >= 1) {
      // PDF sayfa notu
      data.page = Math.floor(body.page)
    } else if (typeof body.startChar === "number" && typeof body.endChar === "number") {
      // Metin vurgusu
      data.startChar = Math.floor(body.startChar)
      data.endChar = Math.floor(body.endChar)
      data.excerpt = String(body.excerpt ?? "").slice(0, 500)
    } else {
      return NextResponse.json({ error: "Konum bilgisi eksik" }, { status: 400 })
    }

    if (typeof body.note === "string" && body.note.trim()) {
      data.note = body.note.trim().slice(0, 2000)
    }

    const highlight = await db.highlight.create({ data })
    return NextResponse.json(highlight, { status: 201 })
  } catch (e) {
    console.error("POST highlights error:", e)
    return NextResponse.json({ error: "Kayıt eklenemedi" }, { status: 500 })
  }
}
