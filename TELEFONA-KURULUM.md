# Kaldığım Yer — telefona kurulum

## Bilgisayarda deneme (aynı Wi-Fi)
1. `bun install` (veya `npm install`)
2. `.env.example` dosyasını `.env` olarak kopyala
3. `bunx prisma generate` ve `bunx prisma db push`
4. `bun run build` ve `bun run start`  (çevrimdışı mod yalnızca bu üretim modunda çalışır)
5. Telefonda `http://BILGISAYAR-IP:3000` adresini aç

## Ana ekrana ekleme
- iPhone: Safari → Paylaş → "Ana Ekrana Ekle"
- Android: Chrome → ⋮ → "Uygulamayı yükle"
Not: Çevrimdışı mod ve tam uygulama kurulumu için adres HTTPS olmalı
(canlı sunucuda). `localhost` hariç http'de servis çalışanı çalışmaz.
