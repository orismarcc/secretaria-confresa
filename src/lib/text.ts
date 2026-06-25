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
