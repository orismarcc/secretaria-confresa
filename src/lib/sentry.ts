/**
 * sentry.ts — monitoramento de erros em produção.
 * Só ativa se VITE_SENTRY_DSN estiver definido (no-op caso contrário),
 * então o app funciona normalmente sem configuração.
 */
import * as Sentry from '@sentry/react';

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return; // sem DSN → desativado, sem efeito

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Captura performance de uma fração das navegações
    tracesSampleRate: 0.2,
    // Replays só em sessões com erro (econômico)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
  });
}

/** Anexa identificação do usuário logado aos eventos (chamado após login). */
export function setSentryUser(user: { id: string; email?: string } | null): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  if (user) Sentry.setUser({ id: user.id, email: user.email });
  else Sentry.setUser(null);
}

export { Sentry };
