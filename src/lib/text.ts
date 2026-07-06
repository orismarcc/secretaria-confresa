/**
 * text.ts — normalização de texto para busca.
 * Remove acentos/diacríticos e caixa, para que "José" case com "jose",
 * "Eusébio" com "eusebio", etc.
 */

const DIACRITICS = /[̀-ͯ]/g;

/** Minúsculas + sem acentos. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase();
}

/** True se `haystack` contém `needle` ignorando acentos e caixa. */
export function textIncludes(
  haystack: string | null | undefined,
  needle: string | null | undefined,
): boolean {
  return normalizeText(haystack).includes(normalizeText(needle));
}

/**
 * Busca por telefone comparando apenas dígitos (ignora () espaços e -).
 * Retorna false se o termo não tiver dígito algum, para não casar tudo
 * quando a pessoa está buscando por nome.
 */
export function phoneMatches(
  phone: string | null | undefined,
  search: string | null | undefined,
): boolean {
  const s = (search ?? '').replace(/\D/g, '');
  if (!s) return false;
  return (phone ?? '').replace(/\D/g, '').includes(s);
}
