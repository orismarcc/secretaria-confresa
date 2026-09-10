/**
 * clockSkew.ts — detecta relógio do aparelho muito fora do horário real.
 *
 * O token de login (JWT) carrega o horário do SERVIDOR em `iat`. Se o relógio
 * do celular estiver muito adiantado/atrasado, o token parece expirado (ou ainda
 * inválido) e a sessão cai segundos após o login — sintoma clássico e específico
 * de um aparelho. Aqui só MEDIMOS e AVISAMOS; nada bloqueia o login.
 */

/** Diferença (em segundos) entre o relógio do aparelho e o horário do token.
 *  Positivo = aparelho adiantado; negativo = atrasado. null se não der pra ler. */
export function tokenClockSkewSeconds(accessToken?: string | null): number | null {
  if (!accessToken) return null;
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const data = JSON.parse(json) as { iat?: number };
    if (!data.iat) return null;
    const deviceNow = Math.floor(Date.now() / 1000);
    return deviceNow - data.iat;
  } catch {
    return null;
  }
}

/** Acima disso o relógio está errado a ponto de derrubar a sessão. 10 min. */
export const CLOCK_SKEW_LIMIT = 600;

/** Chave onde guardamos o aviso para a tela de login exibir. */
export const CLOCK_WARN_KEY = 'authClockWarn';

/** Mensagem amigável. */
export function clockWarnMessage(skew: number): string {
  const dir = skew > 0 ? 'adiantado' : 'atrasado';
  const min = Math.round(Math.abs(skew) / 60);
  return `A data/hora do seu aparelho parece ${dir} (~${min} min). Isso derruba o login. `
    + 'Ajuste em Configurações do celular → Data e hora → "Automático" e tente novamente.';
}
