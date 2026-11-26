"use client";

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Register Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Check if already installed (standalone mode)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) return;

    const dismissed = sessionStorage.getItem("pwa_banner_dismissed");
    if (dismissed) return;

    // Detect iOS Safari
    const ua = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(iosDevice);

    if (iosDevice) {
      const timer = setTimeout(() => setShowBanner(true), 2000);
      return () => clearTimeout(timer);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    const openHandler = () => setShowBanner(true);
    window.addEventListener("open-pwa-install", openHandler);
    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("open-pwa-install", openHandler);
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem("pwa_banner_dismissed", "1");
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-blue-500/40 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-500/40">
            <Download className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">
              Install Aplikasi Presensi SEP
            </h4>
            {isIOS ? (
              <p className="mt-0.5 text-xs text-slate-300">
                Ketuk ikon <Share className="inline h-3.5 w-3.5 text-blue-400" />{" "}
                lalu pilih <strong className="text-white">Add to Home Screen</strong>.
              </p>
            ) : deferredPrompt ? (
              <p className="mt-0.5 text-xs text-slate-300">
                Pasang di layar utama HP agar akses lebih cepat tanpa buka browser.
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-slate-300">
                Jika sudah terpasang, buka dari ikon <strong className="text-white">Presensi SEP</strong> di layar utama HP. Jika belum, ketuk menu browser (<strong className="text-white">⋮</strong>) lalu pilih <strong className="text-white">Tambahkan ke Layar Utama / Install App</strong>.
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!isIOS && deferredPrompt && (
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={handleDismiss}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            Nanti saja
          </button>
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-500"
          >
            <Download className="h-3.5 w-3.5" />
            Install Sekarang
          </button>
        </div>
      )}
    </div>
  );
}
