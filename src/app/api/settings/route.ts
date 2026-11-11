import { NextResponse } from "next/server"
import { db } from "@/lib/db"

const THEMES = ["light", "dark"] as const

/** Eski "sepia" kayıtlarını "light"a çevirir. */
function coerceTheme(t: string | null | undefined): (typeof THEMES)[number] {
  return t === "dark" ? "dark" : "light"
}

export async function GET() {
  let settings = await db.appSettings.findUnique({ where: { id: "default" } })
  if (!settings) {
    settings = await db.appSettings.create({ data: { id: "default" } })
  }
  return NextResponse.json({ theme: coerceTheme(settings.theme) })
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    if (!THEMES.includes(body.theme)) {
      return NextResponse.json({ error: "Geçerli tema yok" }, { status: 400 })
    }
    await db.appSettings.upsert({
      where: { id: "default" },
      update: { theme: body.theme },
      create: { id: "default", theme: body.theme },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("PUT /api/settings error:", e)
    return NextResponse.json({ error: "Ayarlar kaydedilemedi" }, { status: 500 })
  }
}
