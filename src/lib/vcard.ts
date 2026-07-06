/**
 * vcard.ts — exporta contatos como arquivo .vcf (vCard 3.0).
 * Uso: montar contatos e baixar; o usuário importa no celular e cria o
 * grupo de WhatsApp selecionando-os. Ignora números padrão/placeholder.
 */

export interface VCardContact {
  name: string;
  phone: string | null | undefined;
}

// Número usado quando o produtor não tem celular — não deve ir para contatos.
const PLACEHOLDER_DIGITS = '66984444444';

/** Só dígitos. */
function onlyDigits(v: string): string {
  return (v ?? '').replace(/\D/g, '');
}

/** Normaliza para E.164 brasileiro (+55...). Retorna null se inválido/placeholder. */
export function toBrazilE164(phone: string | null | undefined): string | null {
  const d = onlyDigits(phone ?? '');
  if (!d) return null;
  if (d === PLACEHOLDER_DIGITS) return null; // pula o padrão
  // Já com DDI 55 (12–13 dígitos): mantém
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return `+${d}`;
  // Local (fixo 10 / celular 11): prefixa 55
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  // Formato inesperado: não exporta (evita contato inválido)
  return null;
}

/** Escapa caracteres especiais do vCard. */
function escapeVCard(s: string): string {
  return (s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export interface VCardResult {
  vcf: string;
  exported: number;
  skipped: number;
}

/** Monta o conteúdo .vcf a partir dos contatos (pula sem número válido). */
export function buildVCard(contacts: VCardContact[]): VCardResult {
  const blocks: string[] = [];
  let skipped = 0;
  for (const c of contacts) {
    const tel = toBrazilE164(c.phone);
    const name = (c.name ?? '').trim();
    if (!tel || !name) { skipped++; continue; }
    const en = escapeVCard(name);
    blocks.push(
      [
        'BEGIN:VCARD',
        'VERSION:3.0',
        // N (estruturado) é o que muitos celulares usam para gravar o nome;
        // sem ele o contato é salvo só com o número. Nome completo no 1º campo.
        `N:${en};;;;`,
        `FN:${en}`,
        `TEL;TYPE=CELL:${tel}`,
        'END:VCARD',
      ].join('\r\n'),
    );
  }
  return { vcf: blocks.join('\r\n'), exported: blocks.length, skipped };
}

/** Gera e baixa o .vcf. Retorna quantos foram exportados/pulados. */
export function downloadVCard(contacts: VCardContact[], filename = 'contatos.vcf'): VCardResult {
  const result = buildVCard(contacts);
  if (result.exported === 0) return result;
  const blob = new Blob([result.vcf], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.vcf') ? filename : `${filename}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return result;
}
