import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * usePWAInstall
 *
 * Gerencia o ciclo de instalação do PWA.
 * - canInstall: true quando o browser disparou o beforeinstallprompt e o app ainda não está instalado
 * - isInstalled: true quando o app já está rodando em modo standalone (instalado)
 * - install: função que dispara o prompt nativo de instalação
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Verifica se já está rodando em modo standalone (instalado)
    const mq = window.matchMedia('(display-mode: standalone)');
    setIsInstalled(mq.matches);

    const mqHandler = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches);
      if (e.matches) setCanInstall(false);
    };
    mq.addEventListener('change', mqHandler);

    // Captura o evento de prompt de instalação
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Detecta quando o app é instalado com sucesso
    const installedHandler = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
      mq.removeEventListener('change', mqHandler);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setCanInstall(false);
      setDeferredPrompt(null);
    }
  };

  return { canInstall, isInstalled, install };
}
