import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaInstallBanner from "@/components/PwaInstallBanner";

export const metadata: Metadata = {
  title: "PRESENSI SEP - SMA Progresif",
  description:
    "Aplikasi Presensi & Penilaian Rapot Ekstrakurikuler SMA Progresif Bumi Shalawat",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Presensi SEP",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body className="min-h-screen bg-[#0a0d14] text-slate-100 antialiased">
        {children}
        <PwaInstallBanner />
      </body>
    </html>
  );
}
