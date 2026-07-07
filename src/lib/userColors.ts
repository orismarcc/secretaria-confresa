/**
 * userColors.ts — cor padrão por usuário que cadastra registros.
 * Usado para colorir "quem cadastrou" em Entregas e Atendimentos.
 * Casa por parte do nome (sem acento/caixa). Quem não estiver mapeado
 * usa a cor neutra padrão.
 */
import { normalizeText } from './text';

interface Rule { match: string; className: string }

// Ordem importa: a primeira regra que casar vence.
const RULES: Rule[] = [
  { match: 'orismar', className: 'text-blue-600' },              // azul
  { match: 'karynne', className: 'text-pink-500' },              // rosa
  { match: 'pablo',   className: 'text-red-600' },              // vermelho
  { match: 'cassio',  className: 'text-zinc-900 dark:text-zinc-100' }, // preto
];

/** Classe de cor (texto) para o nome de quem cadastrou. */
export function getUserColorClass(name: string | null | undefined): string {
  const n = normalizeText(name);
  if (n) {
    for (const r of RULES) if (n.includes(r.match)) return r.className;
  }
  return 'text-muted-foreground';
}
