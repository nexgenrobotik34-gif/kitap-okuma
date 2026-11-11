import type {
  AppSettingsData,
  BookDetail,
  BookListItem,
  HighlightItem,
  PositionUpdate,
  SegmentItem,
} from "./types"

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "İstek başarısız" }))
    throw new Error((body as { error?: string }).error || "İstek başarısız")
  }
  return res.json() as Promise<T>
}

function xhrUpload(url: string, form: FormData, onProgress?: (pct: number) => void): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", url)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          resolve({ id: "" })
        }
      } else {
        let msg = "Yükleme başarısız"
        try {
          msg = JSON.parse(xhr.responseText).error || msg
        } catch {
          // ignore
        }
        reject(new Error(msg))
      }
    }
    xhr.onerror = () => reject(new Error("Ağ hatası — yükleme başarısız"))
    xhr.send(form)
  })
}

export const api = {
  listBooks: () => fetch("/api/books").then((r) => parseJson<BookListItem[]>(r)),

  getBook: (id: string) => fetch(`/api/books/${id}`).then((r) => parseJson<BookDetail>(r)),

  createBook: (form: FormData, onProgress?: (pct: number) => void) =>
    xhrUpload("/api/books", form, onProgress),

  updateBook: (id: string, patch: PositionUpdate & { title?: string; author?: string }) =>
    fetch(`/api/books/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => parseJson<{ ok: boolean }>(r)),

  deleteBook: (id: string) =>
    fetch(`/api/books/${id}`, { method: "DELETE" }).then((r) => parseJson<{ ok: boolean }>(r)),

  getSettings: () => fetch("/api/settings").then((r) => parseJson<AppSettingsData>(r)),

  saveSettings: (settings: Partial<AppSettingsData>) =>
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }).then((r) => parseJson<{ ok: boolean }>(r)),

  createSegment: (
    bookId: string,
    data: { title: string; startPage?: number; endPage?: number; startPos?: number; endPos?: number }
  ) =>
    fetch(`/api/books/${bookId}/segments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => parseJson<SegmentItem>(r)),

  updateSegment: (id: string, patch: { title?: string; done?: boolean }) =>
    fetch(`/api/segments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => parseJson<SegmentItem>(r)),

  deleteSegment: (id: string) =>
    fetch(`/api/segments/${id}`, { method: "DELETE" }).then((r) => parseJson<{ ok: boolean }>(r)),

  createHighlight: (
    bookId: string,
    data: { page?: number; startChar?: number; endChar?: number; excerpt?: string; note?: string; color?: string }
  ) =>
    fetch(`/api/books/${bookId}/highlights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => parseJson<HighlightItem>(r)),

  updateHighlight: (id: string, patch: { note?: string; color?: string }) =>
    fetch(`/api/highlights/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => parseJson<HighlightItem>(r)),

  deleteHighlight: (id: string) =>
    fetch(`/api/highlights/${id}`, { method: "DELETE" }).then((r) => parseJson<{ ok: boolean }>(r)),

  ocr: (images: string[]) =>
    fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images }),
    }).then((r) => parseJson<{ text: string }>(r)),
}
