import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * usePWAInstall
 *
 * Lê o prompt de instalação capturado globalmente em main.tsx
 * (antes do React montar) e escuta eventos subsequentes.
 *
 * Estados:
 *  - canInstall  → prompt disponível, botão ativo
 *  - isInstalled → app rodando em modo standalone (já instalado)
 */
export function usePWAInstall() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => (window as any).__pwaInstallPrompt ?? null
  );
  const [isInstalled, setIsInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches
  );

  const canInstall = !!prompt && !isInstalled;

  useEffect(() => {
    // Escuta novos prompts que chegarem depois da montagem
    const onReady = () => {
      const p = (window as any).__pwaInstallPrompt;
      if (p) setPrompt(p);
    };
    window.addEventListener('pwa-prompt-ready', onReady);

    // Evento nativo de instalação concluída
    const onInstalled = () => {
      setIsInstalled(true);
      setPrompt(null);
      (window as any).__pwaInstallPrompt = null;
    };
    window.addEventListener('appinstalled', onInstalled);

    // Monitora mudança para modo standalone
    const mq = window.matchMedia('(display-mode: standalone)');
    const mqHandler = (e: MediaQueryListEvent) => {
      if (e.matches) { setIsInstalled(true); setPrompt(null); }
    };
    mq.addEventListener('change', mqHandler);

    return () => {
      window.removeEventListener('pwa-prompt-ready', onReady);
      window.removeEventListener('appinstalled', onInstalled);
      mq.removeEventListener('change', mqHandler);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      setPrompt(null);
      (window as any).__pwaInstallPrompt = null;
    }
  };

  return { canInstall, isInstalled, install };
}
