import { Download, MoreVertical, Share2, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneApp() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function MobileInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [installed, setInstalled] = useState(isStandaloneApp);
  const isIos = useMemo(
    () =>
      typeof navigator !== "undefined" &&
      /iphone|ipad|ipod/i.test(navigator.userAgent),
    []
  );

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const markInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (!installPrompt) {
      setShowInstructions(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  };

  return (
    <>
      <button className="mobile-install-trigger" type="button" onClick={install}>
        <Download size={16} /> Pasang aplikasi
      </button>
      {showInstructions && (
        <div className="mobile-install-dialog-root">
          <button
            className="mobile-install-backdrop"
            type="button"
            aria-label="Tutup petunjuk pemasangan"
            onClick={() => setShowInstructions(false)}
          />
          <section className="mobile-install-dialog" role="dialog" aria-modal="true" aria-label="Pasang aplikasi HealthAir">
            <div className="mobile-install-dialog-head">
              <span><Download size={17} /> Pasang HealthAir</span>
              <button type="button" aria-label="Tutup petunjuk pemasangan" onClick={() => setShowInstructions(false)}><X size={17} /></button>
            </div>
            <p>HealthAir dapat dibuka seperti aplikasi dan tetap memakai website yang sama.</p>
            {isIos ? (
              <ol>
                <li><Share2 size={17} /><span>Tekan tombol <strong>Bagikan</strong> di Safari.</span></li>
                <li><Download size={17} /><span>Pilih <strong>Tambahkan ke Layar Utama</strong>.</span></li>
              </ol>
            ) : (
              <ol>
                <li><MoreVertical size={17} /><span>Buka menu browser.</span></li>
                <li><Download size={17} /><span>Pilih <strong>Instal aplikasi</strong> atau <strong>Tambahkan ke layar utama</strong>.</span></li>
              </ol>
            )}
          </section>
        </div>
      )}
    </>
  );
}
