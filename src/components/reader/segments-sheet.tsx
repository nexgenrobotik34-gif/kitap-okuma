"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { segmentRangeLabel } from "@/lib/segments"
import type { BookDetail, SegmentItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle2, Circle, Crosshair, ListPlus, Pencil, Trash2, X } from "lucide-react"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  book: BookDetail
  segments: SegmentItem[]
  currentSegmentId: string | null
  progress: number
  pendingStart: number | null
  currentPosition: { page: number; ratio: number }
  onJump: (s: SegmentItem) => void
  onSegmentChanged: (s: SegmentItem) => void
  onSegmentDeleted: (id: string) => void
  onSegmentCreated: (s: SegmentItem) => void
}

export function SegmentsSheet({
  open,
  onOpenChange,
  book,
  segments,
  currentSegmentId,
  progress,
  pendingStart,
  currentPosition,
  onJump,
  onSegmentChanged,
  onSegmentDeleted,
  onSegmentCreated,
}: Props) {
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [startPage, setStartPage] = useState(1)
  const [endPage, setEndPage] = useState(1)
  const [startPos, setStartPos] = useState(0)
  const [endPos, setEndPos] = useState(1)
  const [saving, setSaving] = useState(false)
  const [renaming, setRenaming] = useState<SegmentItem | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const isPdf = book.type === "pdf"
  const doneCount = segments.filter((s) => s.done).length

  const sorted = useMemo(() => [...segments].sort((a, b) => a.order - b.order), [segments])

  const openCreateDialog = () => {
    if (isPdf) {
      setStartPage(currentPosition.page)
      setEndPage(currentPosition.page)
    } else {
      const prevEnd = segments
        .filter((s) => (s.endPos ?? 0) <= currentPosition.ratio && (s.endPos ?? 0) > 0)
        .map((s) => s.endPos as number)
        .sort((a, b) => b - a)[0]
      const start = pendingStart ?? prevEnd ?? Math.max(0, currentPosition.ratio - 0.02)
      const s = Math.min(start, currentPosition.ratio)
      // Başlangıç ve bitiş çakışırsa en az %1'lik aralık bırak
      const e = Math.min(1, Math.max(s + 0.01, currentPosition.ratio))
      setStartPos(Math.round(s * 200) / 200)
      setEndPos(Math.round(e * 200) / 200)
    }
    setTitle("")
    setDialogOpen(true)
  }

  const saveSegment = async () => {
    if (!title.trim()) {
      toast({ title: "Segman adı gerekli", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      let created: SegmentItem
      if (isPdf) {
        const max = book.pageCount || 9999
        const s = Math.min(Math.max(1, startPage), max)
        const e = Math.min(Math.max(s, endPage), max)
        created = await api.createSegment(book.id, { title: title.trim(), startPage: s, endPage: e })
      } else {
        let s = startPos
        let e = endPos
        if (e <= s) [s, e] = [e, s]
        // Sıfır uzunluklu aralığı sunucu hatasına düşmeden kurtar
        if (e - s < 0.005) {
          if (s <= 0.99) e = Math.min(1, s + 0.01)
          else s = Math.max(0, e - 0.01)
        }
        created = await api.createSegment(book.id, { title: title.trim(), startPos: s, endPos: e })
      }
      onSegmentCreated(created)
      setDialogOpen(false)
      toast({ title: "Segman eklendi", description: title.trim() })
    } catch (err) {
      toast({
        title: "Segman kaydedilemedi",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleDone = async (s: SegmentItem) => {
    try {
      const updated = await api.updateSegment(s.id, { done: !s.done })
      onSegmentChanged(updated)
    } catch {
      toast({ title: "Güncellenemedi", variant: "destructive" })
    }
  }

  const removeSegment = async (s: SegmentItem) => {
    if (confirmDeleteId !== s.id) {
      setConfirmDeleteId(s.id)
      setTimeout(() => setConfirmDeleteId((cur) => (cur === s.id ? null : cur)), 3000)
      return
    }
    setConfirmDeleteId(null)
    try {
      await api.deleteSegment(s.id)
      onSegmentDeleted(s.id)
      toast({ title: "Segman silindi" })
    } catch {
      toast({ title: "Silinemedi", variant: "destructive" })
    }
  }

  const renameSegment = async () => {
    if (!renaming || !renameValue.trim()) return
    try {
      const updated = await api.updateSegment(renaming.id, { title: renameValue.trim() })
      onSegmentChanged(updated)
      setRenaming(null)
    } catch {
      toast({ title: "Yeniden adlandırılamadı", variant: "destructive" })
    }
  }

  const handleSheetOpenChange = (o: boolean) => {
    if (!o) setConfirmDeleteId(null)
    onOpenChange(o)
  }

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] flex flex-col">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            Segmanlar
            <Badge variant="secondary" className="tabular-nums">
              {doneCount}/{segments.length} bitti
            </Badge>
          </SheetTitle>
          <SheetDescription className="sr-only">Kitabın bölümlerini yönet</SheetDescription>
          <div className="pt-1">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1.5">
              Kitap ilerlemesi: %{Math.round(progress)}
            </p>
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto thin-scroll px-4 pb-4 space-y-2">
          {sorted.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Henüz segman yok. “Segman ekle” ile ilk bölümünü oluştur — kaldığın yeri takip etmek çok kolaylaşacak.
            </div>
          )}
          {sorted.map((s) => {
            const isCurrent = s.id === currentSegmentId
            return (
              <div
                key={s.id}
                className={cn(
                  "rounded-xl border p-3 flex items-start gap-3",
                  isCurrent && "border-primary bg-primary/5"
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleDone(s)}
                  aria-label={s.done ? "Bitmedi olarak işaretle" : "Bitti olarak işaretle"}
                  className="mt-0.5 shrink-0"
                >
                  {s.done ? (
                    <CheckCircle2 className="size-5 text-primary" />
                  ) : (
                    <Circle className="size-5 text-muted-foreground" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium truncate", s.done && "line-through opacity-60")}>
                    {s.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {segmentRangeLabel(book.type, s)}
                    {isCurrent && " · şu an buradasın"}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    onClick={() => onJump(s)}
                    aria-label="Segmana git"
                    title="Segmana git"
                  >
                    <Crosshair className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    onClick={() => {
                      setRenaming(s)
                      setRenameValue(s.title)
                    }}
                    aria-label="Yeniden adlandır"
                    title="Yeniden adlandır"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 text-destructive"
                    onClick={() => removeSegment(s)}
                    aria-label="Sil"
                    title="Sil"
                  >
                    {confirmDeleteId === s.id ? <X className="size-4" /> : <Trash2 className="size-4" />}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button className="w-full h-12" onClick={openCreateDialog}>
            <ListPlus className="size-5" />
            Segman ekle
          </Button>
        </div>

        {/* Segman oluşturma diyaloğu */}
        {dialogOpen && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
            <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-background p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Yeni segman</h3>
                <Button variant="ghost" size="icon" className="size-9" onClick={() => setDialogOpen(false)} aria-label="Kapat">
                  <X className="size-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seg-title">Segman adı</Label>
                <Input
                  id="seg-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Örn: 1. Bölüm — Giriş"
                  autoFocus
                />
              </div>

              {isPdf ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="seg-start">Başlangıç sayfa</Label>
                    <Input
                      id="seg-start"
                      type="number"
                      min={1}
                      max={book.pageCount || undefined}
                      value={startPage}
                      onChange={(e) => setStartPage(parseInt(e.target.value, 10) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seg-end">Bitiş sayfa</Label>
                    <Input
                      id="seg-end"
                      type="number"
                      min={1}
                      max={book.pageCount || undefined}
                      value={endPage}
                      onChange={(e) => setEndPage(parseInt(e.target.value, 10) || 1)}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Başlangıç</Label>
                      <span className="text-xs text-muted-foreground tabular-nums">%{Math.round(startPos * 100)}</span>
                    </div>
                    <Slider min={0} max={100} step={0.5} value={[startPos * 100]} onValueChange={(v) => setStartPos(v[0] / 100)} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Bitiş</Label>
                      <span className="text-xs text-muted-foreground tabular-nums">%{Math.round(endPos * 100)}</span>
                    </div>
                    <Slider min={0} max={100} step={0.5} value={[endPos * 100]} onValueChange={(v) => setEndPos(v[0] / 100)} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Okurken “Başlangıç” düğmesiyle işaretlediğin konum otomatik alındı.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 h-11" onClick={() => setDialogOpen(false)}>
                  Vazgeç
                </Button>
                <Button className="flex-1 h-11" onClick={saveSegment} disabled={saving}>
                  {saving ? "Kaydediliyor…" : "Kaydet"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Yeniden adlandırma diyaloğu */}
        {renaming && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-background p-5 space-y-4 shadow-xl">
              <h3 className="font-semibold">Segmanı yeniden adlandır</h3>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && renameSegment()}
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-11" onClick={() => setRenaming(null)}>
                  Vazgeç
                </Button>
                <Button className="flex-1 h-11" onClick={renameSegment}>
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
