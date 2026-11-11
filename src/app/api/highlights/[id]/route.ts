import { NextResponse } from "next/server"
import { db } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const data: Record<string, unknown> = {}
    if (typeof body.note === "string") data.note = body.note.trim().slice(0, 2000) || null
    if (typeof body.color === "string" && ["yellow", "green", "rose"].includes(body.color)) {
      data.color = body.color
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 })
    }
    const highlight = await db.highlight.update({ where: { id }, data })
    return NextResponse.json(highlight)
  } catch {
    return NextResponse.json({ error: "Not güncellenemedi" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    await db.highlight.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Silinemedi" }, { status: 500 })
  }
}
