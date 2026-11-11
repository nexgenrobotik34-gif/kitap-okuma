import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 120

const PROMPT =
  "Bu görseldeki tüm metni birebir çıkar. Başlık, sayfa numarası gibi eklemeler ya da yorum yapma; " +
  "yalnızca görselde yazılı metni, görseldeki sırayla ve görseldeki dile (muhtemelen Türkçe) aynen yaz. " +
  "Satır sonlarını ve paragrafları koru. Metin dışında hiçbir açıklama, başlık veya not ekleme."

// 1) ANTHROPIC_API_KEY varsa Claude ile (her yerde çalışır)
async function ocrWithClaude(dataUrl: string, apiKey: string): Promise<string> {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/)
  if (!m) throw new Error("Geçersiz görsel formatı")
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.OCR_MODEL || "claude-sonnet-5-5",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Claude API ${res.status}`)
  const data = await res.json()
  return (data.content || [])
    .map((c: { type: string; text?: string }) => (c.type === "text" ? c.text : ""))
    .join("")
    .trim()
}

// 2) Yoksa eski z-ai SDK (yalnızca o ortamda kuruluysa)
async function ocrWithZai(dataUrl: string): Promise<string> {
  const mod = await import("z-ai-web-dev-sdk")
  const ZAI = (mod as { default: { create: () => Promise<any> } }).default
  const zai = await ZAI.create()
  const response = await zai.chat.completions.createVision({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    thinking: { type: "disabled" },
  })
  return (response.choices[0]?.message?.content || "").trim()
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const images: string[] = Array.isArray(body.images) ? body.images.slice(0, 6) : []
    if (images.length === 0) {
      return NextResponse.json({ error: "Görsel gönderilmedi" }, { status: 400 })
    }
    for (const img of images) {
      if (typeof img !== "string" || !img.startsWith("data:image/")) {
        return NextResponse.json({ error: "Geçersiz görsel formatı" }, { status: 400 })
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    const parts: string[] = []
    for (const img of images) {
      let text = ""
      try {
        text = apiKey ? await ocrWithClaude(img, apiKey) : await ocrWithZai(img)
      } catch (e) {
        console.error("OCR sağlayıcı hatası:", e)
        return NextResponse.json(
          {
            error: apiKey
              ? "Fotoğraftan metin okunamadı (API hatası)"
              : "Fotoğraftan metin okuma bu sunucuda kurulu değil. ANTHROPIC_API_KEY ekleyin.",
          },
          { status: 503 }
        )
      }
      if (text) parts.push(text)
    }

    if (parts.length === 0) {
      return NextResponse.json({ error: "Metin çıkarılamadı, görsel okunamadı" }, { status: 422 })
    }
    return NextResponse.json({ text: parts.join("\n\n") })
  } catch (e) {
    console.error("POST /api/ocr error:", e)
    return NextResponse.json({ error: "OCR sırasında bir sorun oluştu" }, { status: 500 })
  }
}
