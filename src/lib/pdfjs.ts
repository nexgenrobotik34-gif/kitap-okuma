"use client"

import type * as PdfJsModule from "pdfjs-dist"

type PdfJs = typeof PdfJsModule

let cached: Promise<PdfJs> | null = null

export function loadPdfJs(): Promise<PdfJs> {
  if (!cached) {
    cached = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
      return m as unknown as PdfJs
    })
  }
  return cached
}
