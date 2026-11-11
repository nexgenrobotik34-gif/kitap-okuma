"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { BookOpen, Moon, Sun } from "lucide-react"
import type { AppSettingsData } from "@/lib/types"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: AppSettingsData
  onChange: (s: AppSettingsData) => void
}

const themeOptions = [
  { value: "sepia" as const, label: "Kâğıt", icon: BookOpen, desc: "Sıcak krem ton" },
  { value: "light" as const, label: "Beyaz", icon: Sun, desc: "Ferah ve net" },
  { value: "dark" as const, label: "Gece", icon: Moon, desc: "Karanlık ortam" },
]

export function ReadingSettingsDialog({ open, onOpenChange, settings, onChange }: Props) {
  const update = (patch: Partial<AppSettingsData>) => {
    onChange({ ...settings, ...patch })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-dvh overflow-y-auto thin-scroll">
        <DialogHeader>
          <DialogTitle>Okuma ayarları</DialogTitle>
          <DialogDescription>
            Ayarlar otomatik kaydedilir, her açılışta hatırlanır.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-1">
          <div className="space-y-2">
            <Label>Okuma teması</Label>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((t) => {
                const Icon = t.icon
                const active = settings.theme === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => update({ theme: t.value })}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border-2 p-3 min-h-[72px] transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent"
                    )}
                    aria-pressed={active}
                  >
                    <Icon className="size-5" />
                    <span className="text-sm font-medium">{t.label}</span>
                    <span className="text-[10px] leading-tight text-center">{t.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="font-size">Yazı boyutu</Label>
              <span className="text-sm text-muted-foreground tabular-nums">{settings.fontSize} px</span>
            </div>
            <Slider
              id="font-size"
              min={14}
              max={28}
              step={1}
              value={[settings.fontSize]}
              onValueChange={(v) => update({ fontSize: v[0] })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="line-height">Satır aralığı</Label>
              <span className="text-sm text-muted-foreground tabular-nums">{(settings.lineHeight / 100).toFixed(2)}</span>
            </div>
            <Slider
              id="line-height"
              min={140}
              max={240}
              step={5}
              value={[settings.lineHeight]}
              onValueChange={(v) => update({ lineHeight: v[0] })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="page-width">Sayfa genişliği</Label>
              <span className="text-sm text-muted-foreground tabular-nums">
                {settings.pageWidth <= 640 ? "Dar" : settings.pageWidth >= 860 ? "Geniş" : "Orta"}
              </span>
            </div>
            <Slider
              id="page-width"
              min={480}
              max={1000}
              step={20}
              value={[settings.pageWidth]}
              onValueChange={(v) => update({ pageWidth: v[0] })}
            />
            <p className="text-xs text-muted-foreground">Geniş ekranlarda metnin en fazla ne kadar yayılacağını belirler.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
