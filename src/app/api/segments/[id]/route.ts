import { NextResponse } from "next/server"
import { db } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const data: Record<string, unknown> = {}
    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim()
    if (typeof body.done === "boolean") data.done = body.done
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 })
    }
    const segment = await db.segment.update({ where: { id }, data })
    return NextResponse.json(segment)
  } catch {
    return NextResponse.json({ error: "Segman güncellenemedi" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    await db.segment.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Segman silinemedi" }, { status: 500 })
  }
}
