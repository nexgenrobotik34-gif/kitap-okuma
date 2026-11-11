// Test kitaplarını temizler + kullanıcı için örnek kitap oluşturur
const BASE = "http://localhost:3000/api"

async function main() {
  // 1) Mevcut test kitaplarını listele ve sil
  const books = await (await fetch(`${BASE}/books`)).json()
  for (const b of books) {
    const del = await fetch(`${BASE}/books/${b.id}`, { method: "DELETE" })
    console.log("silindi:", b.title, del.status)
  }

  // 2) Örnek kitap: konum takibini denemek için yeterince uzun bir metin
  const paragraf = (i) =>
    `Okurken en büyük dert, kitabı kaldırıp sonra geri döndüğünde kaldığın sayfayı bulamamaktır. ` +
    `Künyeler arasında kaybolan kurdeleler, köşeli katlanmış yapraklar, bulanık kalem işaretleri… ` +
    `Hepsi birer hatıra, ama hiçbiri kesin bir cevap değil. Bu uygulama tam bu noktada devreye giriyor: ` +
    `sen kaydırdıkça konumun sessizce kaydediliyor, kitabı kapatsan bile ${i}. paragrafta bıraktığın yer seni bekliyor.\n\n`

  const bolum = (n, adet) =>
    `${n}. Bölüm\n\n` +
    Array.from({ length: adet }, (_, i) => paragraf(n * 10 + i)).join("") +
    `Bu bölümün sonuna geldin. Segmanlar sekmesinden "Segman ekle" düğmesine basarak okuduğun aralığı ` +
    `"${n}. Bölüm" olarak kaydedebilirsin; sonra listeden tıklayıp anında buraya dönebilirsin.\n\n`

  const sample =
    `Sayfa İzi — Deneme Kitabı\n\n` +
    `Bu kitap tamamen örnek amaçlı: buradaki metni okurken uygulamayı keşfedebilirsin. ` +
    `Sağ üstten gece modunu dene, bir cümle seçip sarıya vurgula, "Not ekle" ile düşünceğini yaz, ` +
    `sonra kitabı kapat ve yeniden aç — kaldığın yerden devam edeceksin.\n\n` +
    bolum(1, 6) +
    bolum(2, 6) +
    bolum(3, 6) +
    `Ve son bölüm: artık her şeyi denedin. Konumun otomatik kaydedilir, segmanların listede durur, ` +
    `vurguların ve notların "Notlar" sekmesinde seni bekler. Kendi kitaplarını "Kitap ekle" düğmesiyle PDF ` +
    `olarak ya da yapıştırdığın yazı olarak ekleyebilirsin. İyi okumalar!\n`

  const form = new FormData()
  form.append("type", "text")
  form.append("title", "Sayfa İzi — Nasıl Çalışır? (örnek kitap)")
  form.append("author", "Uygulama Rehberi")
  form.append("text", sample)
  const res = await fetch(`${BASE}/books`, { method: "POST", body: form })
  const created = await res.json()
  console.log("örnek kitap:", res.status, created.id, sample.length, "karakter")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
