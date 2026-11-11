import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { promises as fs } from "fs"
import path from "path"

export const runtime = "nodejs"

const PDF_DIR = path.join(process.cwd(), "db", "pdfs")

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const book = await db.book.findUnique({ where: { id } })
  if (!book || !book.filePath) {
    return NextResponse.json({ error: "PDF bulunamadı" }, { status: 404 })
  }
  try {
    const buf = await fs.readFile(path.join(PDF_DIR, book.filePath))
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return NextResponse.json({ error: "PDF dosyası okunamadı" }, { status: 404 })
  }
}
