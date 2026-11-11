// PDF okuyucu testi için basit çok sayfalı PDF üretir (WinAnsi uyumlu ASCII metin)
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { writeFileSync } from "fs"

async function main() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const totalPages = 12
  for (let p = 1; p <= totalPages; p++) {
    const page = doc.addPage([595, 842]) // A4
    page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(1, 1, 1) })
    page.drawText(`Sample PDF Book`, { x: 50, y: 780, size: 22, font: bold, color: rgb(0.2, 0.15, 0.1) })
    page.drawText(`Page ${p} of ${totalPages}`, { x: 50, y: 750, size: 14, font, color: rgb(0.3, 0.3, 0.3) })
    let y = 700
    for (let line = 0; line < 30; line++) {
      page.drawText(
        `This is line ${line + 1} of page ${p}. The reading position tracker saves your place automatically.`,
        { x: 50, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) }
      )
      y -= 20
    }
  }

  const bytes = await doc.save()
  writeFileSync("/tmp/sample-book.pdf", bytes)
  console.log("PDF olusturuldu:", bytes.length, "bayt,", totalPages, "sayfa")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
