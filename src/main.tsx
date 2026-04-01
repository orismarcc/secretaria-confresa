import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ─── Captura ANTECIPADA do prompt de instalação PWA ────────────────────────
// O evento beforeinstallprompt dispara muito cedo, antes do React montar.
// Guardamos a referência globalmente para o hook usePWAInstall consumir.
(window as any).__pwaInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as any).__pwaInstallPrompt = e;
  // Dispara evento customizado para avisar o hook caso já esteja montado
  window.dispatchEvent(new Event('pwa-prompt-ready'));
});

// ─── Service Worker ────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('[SW] Registered:', reg.scope))
      .catch((err) => console.warn('[SW] Registration failed:', err));
  });
}

createRoot(document.getElementById("root")!).render(<App />);
