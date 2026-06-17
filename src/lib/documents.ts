/**
 * documents.ts — validação e formatação de CPF/CNPJ.
 * Fonte única usada por ProducerForm, SEFAZ e Responsáveis Técnicos.
 */

export type DocType = 'cpf' | 'cnpj';

/** Remove tudo que não for dígito. */
export function onlyDigits(value: string): string {
  return (value ?? '').replace(/\D/g, '');
}

/** Valida CPF pelo algoritmo modulo-11 dos dígitos verificadores. */
export function validateCpf(cpf: string): boolean {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // rejeita 111.111.111-11 etc.
  const sum = (end: number) =>
    digits
      .slice(0, end)
      .split('')
      .reduce((acc, d, i) => acc + Number(d) * (end + 1 - i), 0);
  const rem1 = (sum(9) * 10) % 11;
  if ((rem1 === 10 ? 0 : rem1) !== Number(digits[9])) return false;
  const rem2 = (sum(10) * 10) % 11;
  return (rem2 === 10 ? 0 : rem2) === Number(digits[10]);
}

/** Valida CNPJ pelo algoritmo modulo-11 dos dígitos verificadores. */
export function validateCnpj(cnpj: string): boolean {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  const calc = (len: number) => {
    const weights =
      len === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = digits
      .slice(0, len)
      .split('')
      .reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  if (calc(12) !== Number(digits[12])) return false;
  return calc(13) === Number(digits[13]);
}

/** True se o valor for um CPF OU CNPJ válido. */
export function isValidDocument(value: string): boolean {
  return validateCpf(value) || validateCnpj(value);
}

/** Aplica máscara de CPF: 000.000.000-00 */
export function formatCpf(value: string): string {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/** Aplica máscara de CNPJ: 00.000.000/0000-00 */
export function formatCnpj(value: string): string {
  return onlyDigits(value)
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

/** Aplica a máscara conforme o tipo selecionado. */
export function formatDocument(value: string, type: DocType): string {
  return type === 'cnpj' ? formatCnpj(value) : formatCpf(value);
}

/** Detecta o tipo pelo nº de dígitos (14 = CNPJ, senão CPF). */
export function detectDocType(value: string | null | undefined): DocType {
  return onlyDigits(value ?? '').length === 14 ? 'cnpj' : 'cpf';
}

/** Rótulo apropriado ('CPF' ou 'CNPJ') para um valor armazenado. */
export function documentLabel(value: string | null | undefined): 'CPF' | 'CNPJ' {
  return detectDocType(value) === 'cnpj' ? 'CNPJ' : 'CPF';
}

/** Placeholder da máscara conforme o tipo. */
export function documentPlaceholder(type: DocType): string {
  return type === 'cnpj' ? '00.000.000/0000-00' : '000.000.000-00';
}
