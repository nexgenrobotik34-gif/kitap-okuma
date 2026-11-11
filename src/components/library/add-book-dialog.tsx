"use client"

import { useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { api } from "@/lib/api"
import { loadPdfJs } from "@/lib/pdfjs"
import { useToast } from "@/hooks/use-toast"
import { Camera, FileText, ImagePlus, Loader2, ScanText, Trash2, Type, Upload, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (bookId: string) => void
}

interface PhotoItem {
  id: string
  dataUrl: string
  file: File
}

async function decodeTextFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf)
  } catch {
    return new TextDecoder("windows-1254").decode(buf)
  }
}

async function downscaleImage(file: File, maxSide = 1600, quality = 0.85): Promise<{ dataUrl: string; file: File }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(new Error("Görsel okunamadı"))
    fr.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error("Görsel açılamadı"))
    i.src = dataUrl
  })
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  if (scale >= 1 && file.size < 1.5 * 1024 * 1024) {
    return { dataUrl, file }
  }
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext("2d")
  if (!ctx) return { dataUrl, file }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const out = canvas.toDataURL("image/jpeg", quality)
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", quality)
  )
  return { dataUrl: out, file: new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) }
}

function titleFromFileName(name: string): string {
  return name
    .replace(/\.(pdf|txt|md)$/i, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .slice(0, 120)
}

export function AddBookDialog({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast()
  const [tab, setTab] = useState("pdf")
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [saving, setSaving] = useState(false)
  const [uploadPct, setUploadPct] = useState<number | null>(null)

  // PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfPages, setPdfPages] = useState<number | null>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  // Metin
  const [textContent, setTextContent] = useState("")
  const textInputRef = useRef<HTMLInputElement>(null)

  // Fotoğraf
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [ocrBusy, setOcrBusy] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setTitle("")
    setAuthor("")
    setSaving(false)
    setUploadPct(null)
    setPdfFile(null)
    setPdfPages(null)
    setTextContent("")
    setPhotos([])
    setTab("pdf")
  }

  const pickPdf = async (file: File) => {
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      toast({ title: "Lütfen bir PDF dosyası seç", variant: "destructive" })
      return
    }
    setPdfFile(file)
    setPdfPages(null)
    if (!title) setTitle(titleFromFileName(file.name))
    // Sayfa sayısını istemcide bul
    try {
      const pdfjs = await loadPdfJs()
      const buf = await file.arrayBuffer()
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
      setPdfPages(doc.numPages)
      void doc.destroy()
    } catch {
      // Sayfa sayısı ilk açılışta öğrenilir
    }
  }

  const pickTextFile = async (file: File) => {
    try {
      const text = await decodeTextFile(file)
      setTextContent(text)
      if (!title) setTitle(titleFromFileName(file.name))
    } catch {
      toast({ title: "Dosya okunamadı", variant: "destructive" })
    }
  }

  const addPhotos = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 6)
    const items: PhotoItem[] = []
    for (const f of arr) {
      try {
        const { dataUrl, file } = await downscaleImage(f)
        items.push({ id: `${Date.now()}-${Math.random()}`, dataUrl, file })
      } catch {
        toast({ title: `${f.name} hazırlanamadı`, variant: "destructive" })
      }
    }
    setPhotos((prev) => [...prev, ...items].slice(0, 6))
    if (!title && arr[0]) setTitle(titleFromFileName(`Okunan sayfalar ${new Date().toLocaleDateString("tr-TR")}`))
  }

  const runOcr = async () => {
    if (photos.length === 0) return
    setOcrBusy(true)
    try {
      const res = await api.ocr(photos.map((p) => p.dataUrl))
      setTextContent((prev) => (prev.trim() ? `${prev}\n\n${res.text}` : res.text))
      toast({ title: "Metin çıkarıldı", description: "İstersen düzenleyip kaydet." })
    } catch (e) {
      toast({
        title: "Metin çıkarılamadı",
        description: e instanceof Error ? e.message : "Tekrar dene",
        variant: "destructive",
      })
    } finally {
      setOcrBusy(false)
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      if (tab === "pdf") {
        if (!pdfFile) {
          toast({ title: "Önce bir PDF dosyası seç", variant: "destructive" })
          return
        }
        if (!title.trim()) {
          toast({ title: "Kitap adı gerekli", variant: "destructive" })
          return
        }
        const form = new FormData()
        form.append("type", "pdf")
        form.append("title", title.trim())
        form.append("author", author.trim())
        form.append("file", pdfFile)
        if (pdfPages) form.append("pageCount", String(pdfPages))
        const res = await api.createBook(form, (p) => setUploadPct(p))
        onCreated(res.id)
        onOpenChange(false)
        reset()
        return
      }

      // metin veya OCR
      if (!textContent.trim()) {
        toast({ title: "Metin boş olamaz", variant: "destructive" })
        return
      }
      if (!title.trim()) {
        toast({ title: "Kitap adı gerekli", variant: "destructive" })
        return
      }
      const form = new FormData()
      form.append("type", "text")
      form.append("title", title.trim())
      form.append("author", author.trim())
      form.append("text", textContent)
      const res = await api.createBook(form)
      onCreated(res.id)
      onOpenChange(false)
      reset()
      return
    } catch (e) {
      toast({
        title: "Kitap kaydedilemedi",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
      setUploadPct(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="max-w-lg max-h-dvh overflow-y-auto thin-scroll">
        <DialogHeader>
          <DialogTitle>Kitap ekle</DialogTitle>
          <DialogDescription>
            PDF yükle, metin yapıştır ya da kitap sayfasının fotoğrafını çek — hepsi aynı kütüphanede.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="pdf" className="gap-1.5">
              <FileText className="size-4" /> PDF
            </TabsTrigger>
            <TabsTrigger value="text" className="gap-1.5">
              <Type className="size-4" /> Metin
            </TabsTrigger>
            <TabsTrigger value="ocr" className="gap-1.5">
              <Camera className="size-4" /> Fotoğraf
            </TabsTrigger>
          </TabsList>

          {/* PDF sekmesi */}
          <TabsContent value="pdf" className="space-y-4 mt-2">
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) pickPdf(f)
                e.target.value = ""
              }}
            />
            {pdfFile ? (
              <div className="rounded-xl border p-4 flex items-center gap-3">
                <FileText className="size-8 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{pdfFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(pdfFile.size / 1024 / 1024).toFixed(1)} MB
                    {pdfPages ? ` · ${pdfPages} sayfa` : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 text-destructive"
                  onClick={() => {
                    setPdfFile(null)
                    setPdfPages(null)
                  }}
                  aria-label="Dosyayı kaldır"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-2 hover:bg-accent transition-colors min-h-[120px]"
              >
                <Upload className="size-7 text-muted-foreground" />
                <span className="text-sm font-medium">PDF dosyası seç</span>
                <span className="text-xs text-muted-foreground">Telefonundan veya bilgisayarından</span>
              </button>
            )}
            <div className="space-y-2">
              <Label htmlFor="pdf-title">Kitap adı</Label>
              <Input id="pdf-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn: Suç ve Ceza" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pdf-author">Yazar (isteğe bağlı)</Label>
              <Input id="pdf-author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Örn: Dostoyevski" />
            </div>
          </TabsContent>

          {/* Metin sekmesi */}
          <TabsContent value="text" className="space-y-4 mt-2">
            <input
              ref={textInputRef}
              type="file"
              accept=".txt,.md,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) pickTextFile(f)
                e.target.value = ""
              }}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-11" onClick={() => textInputRef.current?.click()}>
                <FileText className="size-4" /> .txt dosyası aç
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="text-content">Ya da metni buraya yapıştır</Label>
              <Textarea
                id="text-content"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={7}
                placeholder="Uzun bir metni, bir yazıyı veya notlarını yapıştırabilirsin…"
              />
              {textContent.length > 0 && (
                <p className="text-xs text-muted-foreground text-right tabular-nums">
                  {textContent.length.toLocaleString("tr-TR")} karakter
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="text-title">Kitap / yazı adı</Label>
              <Input id="text-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn: Deneme Yazılarım" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="text-author">Yazar (isteğe bağlı)</Label>
              <Input id="text-author" value={author} onChange={(e) => setAuthor(e.target.value)} />
            </div>
          </TabsContent>

          {/* Fotoğraf / OCR sekmesi */}
          <TabsContent value="ocr" className="space-y-4 mt-2">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addPhotos(e.target.files)
                e.target.value = ""
              }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addPhotos(e.target.files)
                e.target.value = ""
              }}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-12" onClick={() => cameraInputRef.current?.click()}>
                <Camera className="size-4" /> Fotoğraf çek
              </Button>
              <Button variant="outline" className="h-12" onClick={() => galleryInputRef.current?.click()}>
                <ImagePlus className="size-4" /> Galeriden seç
              </Button>
            </div>

            {photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((p) => (
                  <div key={p.id} className="relative shrink-0">
                    <img
                      src={p.dataUrl}
                      alt="Sayfa fotoğrafı"
                      className="size-20 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      className="absolute -top-2 -right-2 size-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow"
                      onClick={() => setPhotos((prev) => prev.filter((x) => x.id !== p.id))}
                      aria-label="Fotoğrafı kaldır"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Button
              className="w-full h-12"
              onClick={runOcr}
              disabled={photos.length === 0 || ocrBusy}
            >
              {ocrBusy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Metin çıkarılıyor…
                </>
              ) : (
                <>
                  <ScanText className="size-4" /> Metni çıkar ({photos.length} sayfa)
                </>
              )}
            </Button>

            <div className="space-y-2">
              <Label htmlFor="ocr-text">Çıkarılan metin (düzenleyebilirsin)</Label>
              <Textarea
                id="ocr-text"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={7}
                placeholder="OCR sonucu burada görünecek…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ocr-title">Kitap / yazı adı</Label>
              <Input id="ocr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn: Kitap Okumaları" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ocr-author">Yazar (isteğe bağlı)</Label>
              <Input id="ocr-author" value={author} onChange={(e) => setAuthor(e.target.value)} />
            </div>
          </TabsContent>
        </Tabs>

        {uploadPct != null && (
          <div className="space-y-1.5">
            <Progress value={uploadPct} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">Yükleniyor… %{uploadPct}</p>
          </div>
        )}

        <Button
          className="w-full h-12 text-base"
          onClick={save}
          disabled={saving || (tab === "pdf" ? !pdfFile : !textContent.trim())}
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Kaydediliyor…
            </>
          ) : (
            "Kitabı kaydet ve okumaya başla"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
