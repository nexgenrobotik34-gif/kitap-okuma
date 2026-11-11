import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaRegister } from "@/components/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kaldığım Yer — Kitap Okuma Takibi",
  description:
    "PDF ve metin kitapları yükleyin, segmanlara bölün, kaldığınız yer otomatik kaydedilsin; vurgu ve notlarla okuma alışkanlığı edinin.",
  applicationName: "Kaldığım Yer",
  appleWebApp: {
    capable: true,
    title: "Kaldığım Yer",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#3b2a1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-dvh`}
      >
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
        <PwaRegister />
      </body>
    </html>
  );
}
