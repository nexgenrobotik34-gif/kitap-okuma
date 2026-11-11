"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BookOpen, LibraryBig, Moon, Plus, Sun, Trash2 } from "lucide-react"
import { BookCard } from "./book-card"
import { AddBookDialog } from "./add-book-dialog"
import { api } from "@/lib/api"
import type { BookListItem, ReadingTheme } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

interface Props {
  books: BookListItem[]
  loading: boolean
  theme: ReadingTheme
  onThemeChange: (t: ReadingTheme) => void
  onOpenBook: (id: string) => void
  onBooksChanged: () => void
}

export function LibraryView({ books, loading, theme, onThemeChange, onOpenBook, onBooksChanged }: Props) {
  const { toast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [renaming, setRenaming] = useState<BookListItem | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [deleting, setDeleting] = useState<BookListItem | null>(null)

  const saveRename = async () => {
    if (!renaming || !renameValue.trim()) return
    try {
      await api.updateBook(renaming.id, { title: renameValue.trim() })
      setRenaming(null)
      onBooksChanged()
      toast({ title: "Kitap adı güncellendi" })
    } catch {
      toast({ title: "Yeniden adlandırılamadı", variant: "destructive" })
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await api.deleteBook(deleting.id)
      setDeleting(null)
      onBooksChanged()
      toast({ title: "Kitap silindi" })
    } catch {
      toast({ title: "Silinemedi", variant: "destructive" })
    }
  }

  const finished = books.filter((b) => {
    if (b.type === "pdf" && b.pageCount > 0) return b.lastPage >= b.pageCount
    if (b.type === "text") return b.lastScroll >= 0.995
    return false
  }).length

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <BookOpen className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold leading-tight truncate">Kaldığım Yer</h1>
              <p className="text-[11px] text-muted-foreground leading-tight truncate">
                {books.length > 0
                  ? `${books.length} kitap · ${finished} bitti · konumun hep kayıtlı`
                  : "Okuduğun her sayfa burada güvende"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "Gündüz moduna geç" : "Gece moduna geç"}
            title={theme === "dark" ? "Gündüz modu" : "Gece modu"}
          >
            {theme === "dark" ? <Moon className="size-5" /> : <Sun className="size-5" />}
          </Button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-4 space-y-3">
        <Button
          size="lg"
          className="w-full h-14 text-base shadow-sm"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="size-5" /> Kitap ekle
        </Button>

        {loading ? (
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border p-4 space-y-3 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-2 bg-muted rounded w-full" />
                <div className="h-11 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 mt-6 text-center space-y-3">
            <div className="mx-auto size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <LibraryBig className="size-7" />
            </div>
            <h2 className="font-semibold">Kütüphanen boş</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              İlk kitabını ekle: PDF yükle, bir yazı yapıştır ya da kitap sayfasının fotoğrafını çek.
              Okuduğun yer otomatik kaydedilir — kapatsan bile kaldığın satırdan devam edersin.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {books.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                onOpen={onOpenBook}
                onRename={(book) => {
                  setRenaming(book)
                  setRenameValue(book.title)
                }}
                onDelete={(book) => setDeleting(book)}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="mt-auto border-t">
        <div className="max-w-2xl mx-auto px-4 h-10 flex items-center justify-center">
          <p className="text-[11px] text-muted-foreground">
            Kaldığım Yer — okurken konumun otomatik kaydedilir, hiçbir yer kaybolmaz.
          </p>
        </div>
      </footer>

      <AddBookDialog open={addOpen} onOpenChange={setAddOpen} onCreated={onOpenBook} />

      {/* Yeniden adlandırma */}
      {renaming && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-background p-5 space-y-4 shadow-xl">
            <h3 className="font-semibold">Kitap adını değiştir</h3>
            <div className="space-y-2">
              <Label htmlFor="rename-input" className="sr-only">
                Kitap adı
              </Label>
              <Input
                id="rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && saveRename()}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-11" onClick={() => setRenaming(null)}>
                Vazgeç
              </Button>
              <Button className="flex-1 h-11" onClick={saveRename}>
                Kaydet
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Silme onayı */}
      {deleting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-background p-5 space-y-4 shadow-xl">
            <h3 className="font-semibold">“{deleting.title}” silinsin mi?</h3>
            <p className="text-sm text-muted-foreground">
              Kitabın konumu, segmanları ve tüm notları birlikte silinir. Bu işlem geri alınamaz.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-11" onClick={() => setDeleting(null)}>
                Vazgeç
              </Button>
              <Button variant="destructive" className="flex-1 h-11" onClick={confirmDelete}>
                <Trash2 className="size-4" /> Sil
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
