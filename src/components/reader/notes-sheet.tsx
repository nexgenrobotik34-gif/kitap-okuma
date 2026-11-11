"use client"

import { useEffect, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { formatDistanceToNow } from "date-fns"
import { tr } from "date-fns/locale"
import type { BookDetail, HighlightItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Crosshair, Pencil, StickyNote, Trash2, X } from "lucide-react"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  book: BookDetail
  highlights: HighlightItem[]
  onJump: (h: HighlightItem) => void
  onHighlightChanged: (h: HighlightItem) => void
  onHighlightDeleted: (id: string) => void
}

const colorDot: Record<string, string> = {
  yellow: "bg-[rgba(245,190,40,0.9)]",
  green: "bg-[rgba(74,190,120,0.9)]",
  rose: "bg-[rgba(235,100,130,0.9)]",
}

export function NotesSheet({
  open,
  onOpenChange,
  book,
  highlights,
  onJump,
  onHighlightChanged,
  onHighlightDeleted,
}: Props) {
  const { toast } = useToast()
  const [editing, setEditing] = useState<HighlightItem | null>(null)
  const [editNote, setEditNote] = useState("")
  const [editColor, setEditColor] = useState("yellow")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setEditing(null)
      setConfirmDeleteId(null)
    }
    onOpenChange(o)
  }

  const openEdit = (h: HighlightItem) => {
    setEditing(h)
    setEditNote(h.note ?? "")
    setEditColor(h.color)
  }

  const saveEdit = async () => {
    if (!editing) return
    try {
      const updated = await api.updateHighlight(editing.id, { note: editNote, color: editColor })
      onHighlightChanged(updated)
      setEditing(null)
      toast({ title: "Not güncellendi" })
    } catch {
      toast({ title: "Not güncellenemedi", variant: "destructive" })
    }
  }

  const removeHighlight = async (h: HighlightItem) => {
    if (confirmDeleteId !== h.id) {
      setConfirmDeleteId(h.id)
      setTimeout(() => setConfirmDeleteId((cur) => (cur === h.id ? null : cur)), 3000)
      return
    }
    setConfirmDeleteId(null)
    try {
      await api.deleteHighlight(h.id)
      onHighlightDeleted(h.id)
      toast({ title: "Silindi" })
    } catch {
      toast({ title: "Silinemedi", variant: "destructive" })
    }
  }

  const locationLabel = (h: HighlightItem): string => {
    if (h.page != null) return `s. ${h.page}`
    if (h.startChar != null && book.charCount > 0) {
      return `konum %${Math.round((h.startChar / book.charCount) * 100)}`
    }
    return ""
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] flex flex-col">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            Vurgular & Notlar
            <Badge variant="secondary">{highlights.length}</Badge>
          </SheetTitle>
          <SheetDescription className="sr-only">Kitaptaki tüm vurgular ve notlar</SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto thin-scroll px-4 pb-4 space-y-2">
          {highlights.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {book.type === "text"
                ? "Metinde bir cümle seçtiğinde vurgu ve not ekleyebilirsin."
                : "Okuduğun sayfada “Sayfa notu” düğmesiyle not bırakabilirsin."}
            </div>
          )}
          {highlights.map((h) => (
            <div key={h.id} className="rounded-xl border p-3 space-y-2">
              <div className="flex items-start gap-2">
                <span
                  className={cn("mt-1.5 size-3 rounded-full shrink-0", colorDot[h.color] ?? colorDot.yellow)}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  {h.excerpt ? (
                    <p className="text-sm italic line-clamp-3 text-foreground/90">“{h.excerpt}”</p>
                  ) : (
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <StickyNote className="size-4 text-muted-foreground" />
                      Sayfa notu
                    </p>
                  )}
                  {h.note && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{h.note}</p>}
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {locationLabel(h)} ·{" "}
                    {formatDistanceToNow(new Date(h.createdAt), { addSuffix: true, locale: tr })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => onJump(h)}
                  title="Konuma git"
                >
                  <Crosshair className="size-4" />
                  Git
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => openEdit(h)}
                  title="Düzenle"
                >
                  <Pencil className="size-4" />
                  Düzenle
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs text-destructive"
                  onClick={() => removeHighlight(h)}
                  title="Sil"
                >
                  {confirmDeleteId === h.id ? <X className="size-4" /> : <Trash2 className="size-4" />}
                  {confirmDeleteId === h.id ? "Emin misin?" : "Sil"}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Not düzenleme diyaloğu */}
        {editing && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
            <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-background p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Notu düzenle</h3>
                <Button variant="ghost" size="icon" className="size-9" onClick={() => setEditing(null)} aria-label="Kapat">
                  <X className="size-4" />
                </Button>
              </div>
              {editing.excerpt && (
                <p className="text-sm italic text-muted-foreground border-l-2 border-primary/40 pl-3 line-clamp-3">
                  “{editing.excerpt}”
                </p>
              )}
              <Textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Bu bölümle ilgili düşüncelerin…"
                rows={4}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Renk:</span>
                {[
                  { color: "yellow", cls: "bg-[rgba(245,190,40,0.9)]", label: "Sarı" },
                  { color: "green", cls: "bg-[rgba(74,190,120,0.9)]", label: "Yeşil" },
                  { color: "rose", cls: "bg-[rgba(235,100,130,0.9)]", label: "Pembe" },
                ].map((c) => (
                  <button
                    key={c.color}
                    type="button"
                    aria-label={c.label}
                    onClick={() => setEditColor(c.color)}
                    className={cn(
                      "size-8 rounded-full border-2 transition-transform active:scale-90",
                      colorDot[c.color],
                      editColor === c.color ? "border-foreground scale-110" : "border-transparent"
                    )}
                  />
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 h-11" onClick={() => setEditing(null)}>
                  Vazgeç
                </Button>
                <Button className="flex-1 h-11" onClick={saveEdit}>
                  Kaydet
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
