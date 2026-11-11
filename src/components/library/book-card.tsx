"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { computeProgress, formatDuration } from "@/lib/types"
import type { BookListItem } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"
import { tr } from "date-fns/locale"
import { FileText, ListTree, MoreVertical, PenLine, Play, Trash2, Type } from "lucide-react"

interface Props {
  book: BookListItem
  onOpen: (id: string) => void
  onRename: (book: BookListItem) => void
  onDelete: (book: BookListItem) => void
}

export function BookCard({ book, onOpen, onRename, onDelete }: Props) {
  const progress = computeProgress(book)
  const lastRead = book.lastReadAt
    ? formatDistanceToNow(new Date(book.lastReadAt), { addSuffix: true, locale: tr })
    : "Henüz okunmadı"

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {book.type === "pdf" ? <FileText className="size-5" /> : <Type className="size-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <button
              type="button"
              className="w-full text-left"
              onClick={() => onOpen(book.id)}
              aria-label={`${book.title} kitabını aç`}
            >
              <h3 className="font-semibold text-sm leading-snug line-clamp-2">{book.title}</h3>
            </button>
            {book.author && <p className="text-xs text-muted-foreground mt-0.5 truncate">{book.author}</p>}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-9 shrink-0" aria-label="Kitap menüsü">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onRename(book)}>
                <PenLine className="size-4" /> Yeniden adlandır
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(book)} className="text-destructive focus:text-destructive">
                <Trash2 className="size-4" /> Sil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium tabular-nums">%{Math.round(progress)} tamamlandı</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {book.type === "pdf"
                ? `s. ${Math.min(book.lastPage, book.pageCount || book.lastPage)}/${book.pageCount || "?"}`
                : `%${Math.round(book.lastScroll * 100)} konumu`}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="truncate">{lastRead}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{formatDuration(book.totalTimeSec)}</span>
          {book.segmentCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1 shrink-0">
                <ListTree className="size-3.5" />
                {book.segmentCount} segman
              </span>
            </>
          )}
        </div>

        <Button className="w-full h-11" onClick={() => onOpen(book.id)}>
          <Play className="size-4" />
          {book.lastReadAt ? "Devam et" : "Okumaya başla"}
        </Button>
      </CardContent>
    </Card>
  )
}
