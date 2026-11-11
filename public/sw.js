// Kaldığım Yer — basit çevrimdışı önbellek
const VERSION = "v1"
const STATIC = `static-${VERSION}`
const PAGES = `pages-${VERSION}`
const DATA = `data-${VERSION}`
const KEEP = [STATIC, PAGES, DATA]

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(PAGES).then((c) => c.add("/").catch(() => {})).then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(req)
    if (res && res.status === 200) cache.put(req, res.clone())
    return res
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: false })
    if (hit) return hit
    throw err
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res && res.status === 200) cache.put(req, res.clone())
  return res
}

self.addEventListener("fetch", (e) => {
  const req = e.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/ocr")) return

  // Sayfa açılışı: önce ağ, çevrimdışıysa kayıtlı ana sayfa
  if (req.mode === "navigate") {
    e.respondWith(
      networkFirst(req, PAGES).catch(() => caches.match("/").then((r) => r || Response.error()))
    )
    return
  }

  // Sabit dosyalar: önce önbellek
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".mjs") ||
    url.pathname.endsWith(".woff2")
  ) {
    e.respondWith(cacheFirst(req, STATIC))
    return
  }

  // Kitap verisi ve PDF dosyaları: önce ağ, çevrimdışıysa son kayıtlı hali
  if (url.pathname.startsWith("/api/")) {
    // Range (206) istekleri önbelleğe yazılamaz, doğrudan geçir
    if (req.headers.has("range")) return
    e.respondWith(networkFirst(req, DATA))
  }
})
