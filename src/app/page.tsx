"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { LibraryView } from "@/components/library/library-view"
import { ReaderView } from "@/components/reader/reader-view"
import { api } from "@/lib/api"
import type { BookListItem, ReadingTheme } from "@/lib/types"

function bookIdFromHash(): string | null {
  const m = window.location.hash.match(/^#kitap-(.+)$/)
  return m ? m[1] : null
}

export default function Home() {
  const { setTheme } = useTheme()
  const [theme, setThemeState] = useState<ReadingTheme>("light")
  const [books, setBooks] = useState<BookListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeBookId, setActiveBookId] = useState<string | null>(null)
  const themeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadBooks = useCallback(() => {
    api
      .listBooks()
      .then(setBooks)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Kayıtlı temayı yükle
  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setThemeState(s.theme)
        setTheme(s.theme)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [setTheme])

  // Kitap açılışını URL hash'iyle eşitle: yenilenince de kitabın içinde kalır
  useEffect(() => {
    const apply = () => {
      const id = bookIdFromHash()
      setActiveBookId(id)
      if (!id) loadBooks()
    }
    apply()
    window.addEventListener("hashchange", apply)
    return () => window.removeEventListener("hashchange", apply)
  }, [loadBooks])

  const openBook = useCallback((id: string) => {
    window.location.hash = `#kitap-${id}`
  }, [])

  const exitReader = useCallback(() => {
    if (bookIdFromHash()) {
      // hash değişimi hashchange dinleyicisini tetikler, kitaplık listesi tazelenir
      window.location.hash = "kitaplik"
    } else {
      setActiveBookId(null)
    }
  }, [])

  const handleThemeChange = useCallback(
    (next: ReadingTheme) => {
      setThemeState(next)
      setTheme(next)
      if (themeTimer.current) clearTimeout(themeTimer.current)
      themeTimer.current = setTimeout(() => {
        api.saveSettings({ theme: next }).catch(() => {})
      }, 400)
    },
    [setTheme]
  )

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div
          className="size-8 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin"
          aria-label="Yükleniyor"
        />
      </div>
    )
  }

  if (activeBookId) {
    return (
      <ReaderView
        key={activeBookId}
        bookId={activeBookId}
        theme={theme}
        onThemeChange={handleThemeChange}
        onExit={exitReader}
        onLibraryRefresh={loadBooks}
      />
    )
  }

  return (
    <LibraryView
      books={books}
      loading={loading}
      theme={theme}
      onThemeChange={handleThemeChange}
      onOpenBook={openBook}
      onBooksChanged={loadBooks}
    />
  )
}
