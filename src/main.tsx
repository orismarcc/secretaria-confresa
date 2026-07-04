import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry, Sentry } from "./lib/sentry";

// Monitoramento de erros (ativa só se VITE_SENTRY_DSN estiver definido)
initSentry();

// Tela de fallback caso algum componente quebre — evita "tela em branco"
// e reporta ao Sentry (quando ativo). Estilos inline para renderizar sempre.
const errorFallback = (
  <div style={{
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24,
    textAlign: 'center', fontFamily: 'system-ui, sans-serif', color: '#1f2937',
  }}>
    <div style={{ fontSize: 40 }}>⚠️</div>
    <h1 style={{ fontSize: 20, fontWeight: 700 }}>Algo deu errado</h1>
    <p style={{ color: '#6b7280', maxWidth: 360 }}>
      Ocorreu um erro inesperado nesta tela. Recarregue a página; se o problema persistir, avise o suporte.
    </p>
    <button
      onClick={() => window.location.reload()}
      style={{
        marginTop: 8, padding: '10px 20px', borderRadius: 8, border: 'none',
        background: '#2d5a27', color: '#fff', fontWeight: 600, cursor: 'pointer',
      }}
    >
      Recarregar
    </button>
  </div>
);

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

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={errorFallback}>
    <App />
  </Sentry.ErrorBoundary>
);
