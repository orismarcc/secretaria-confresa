import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * usePWAInstall
 *
 * Captures the `beforeinstallprompt` browser event so we can trigger
 * the Add-to-Home-Screen prompt on demand (e.g., via a download button).
 *
 * Returns:
 *   canInstall – true when the prompt is available (browser supports PWA install
 *                AND the app hasn't already been installed)
 *   install    – function that triggers the native install prompt
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // If already installed (standalone mode), hide the button
    const mq = window.matchMedia('(display-mode: standalone)');
    if (mq.matches) setCanInstall(false);
    const mqHandler = (e: MediaQueryListEvent) => { if (e.matches) setCanInstall(false); };
    mq.addEventListener('change', mqHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
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

  return { canInstall, install };
}
