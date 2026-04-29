/**
 * AVI (Prestação de Contas Verba Indenizatória) document generator.
 *
 * Loads the template .docx from /AVI_template.docx, injects:
 *   - The selected month name in the COMPETÊNCIA field
 *   - The list of completed services as table rows in the
 *     "RELATÓRIO DE ATIVIDADES EXECUTADAS" section
 *
 * Returns a Blob ready to be downloaded as a .docx file.
 */

import PizZip from 'pizzip';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
export interface AviService {
  /** Full activity description, already upper-cased */
  description: string;
  /** Formatted date string, e.g. "02/03/2026" */
  date: string;
}

// ------------------------------------------------------------------
// Month names in Portuguese (all-caps)
// ------------------------------------------------------------------
export const MONTHS_PT: Record<number, string> = {
  1:  'JANEIRO',
  2:  'FEVEREIRO',
  3:  'MARÇO',
  4:  'ABRIL',
  5:  'MAIO',
  6:  'JUNHO',
  7:  'JULHO',
  8:  'AGOSTO',
  9:  'SETEMBRO',
  10: 'OUTUBRO',
  11: 'NOVEMBRO',
  12: 'DEZEMBRO',
};

// ------------------------------------------------------------------
// Build one OOXML table row for an activity
// ------------------------------------------------------------------
function buildActivityRow(description: string, date: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;');

  const rPrBase = `<w:rFonts w:ascii="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman"/><w:b w:val="0"/><w:bCs w:val="0"/><w:i w:val="0"/><w:iCs w:val="0"/><w:smallCaps w:val="0"/><w:strike w:val="0"/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:u w:val="none"/><w:shd w:fill="auto" w:val="clear"/><w:vertAlign w:val="baseline"/><w:rtl w:val="0"/>`;

  const rPrSmall = `<w:rFonts w:ascii="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="000000"/>`;

  const emptyCell = (vMerge = true) =>
    `<w:tc><w:tcPr>${vMerge ? '<w:vMerge w:val="restart"/>' : ''}<w:tcBorders><w:top w:color="000000" w:space="0" w:sz="0" w:val="nil"/><w:bottom w:color="000000" w:space="0" w:sz="0" w:val="nil"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:spacing w:after="0" w:before="0" w:line="240" w:lineRule="auto"/><w:rPr>${rPrSmall}</w:rPr></w:pPr></w:p></w:tc>`;

  return `<w:tr><w:trPr><w:cantSplit w:val="0"/><w:trHeight w:val="551" w:hRule="atLeast"/><w:tblHeader w:val="0"/></w:trPr>${emptyCell(true)}<w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:pPr><w:keepNext w:val="0"/><w:keepLines w:val="0"/><w:spacing w:after="0" w:before="0" w:line="274" w:lineRule="auto"/><w:ind w:left="110" w:right="42" w:firstLine="0"/><w:jc w:val="left"/><w:rPr>${rPrBase}</w:rPr></w:pPr><w:r><w:rPr>${rPrBase}</w:rPr><w:t xml:space="preserve">${esc(description)}</w:t></w:r></w:p></w:tc><w:tc><w:tcPr/><w:p><w:pPr><w:keepNext w:val="0"/><w:keepLines w:val="0"/><w:spacing w:after="0" w:before="0" w:line="273" w:lineRule="auto"/><w:ind w:left="1" w:right="65" w:firstLine="0"/><w:jc w:val="center"/><w:rPr>${rPrBase}</w:rPr></w:pPr><w:r><w:rPr>${rPrBase}</w:rPr><w:t xml:space="preserve">${esc(date)}</w:t></w:r></w:p></w:tc>${emptyCell(true)}</w:tr>`;
}

// ------------------------------------------------------------------
// Main generator
// ------------------------------------------------------------------
export async function generateAVI(
  monthNumber: number,
  year: number,
  services: AviService[],
): Promise<Blob> {
  // 1. Load the template
  const response = await fetch('/AVI_template.docx');
  if (!response.ok) throw new Error('Não foi possível carregar o template AVI.');
  const templateBuffer = await response.arrayBuffer();

  // 2. Open the ZIP
  const zip = new PizZip(templateBuffer);
  let xml: string = zip.file('word/document.xml')!.asText();

  // 3. Replace the month name in the COMPETÊNCIA section
  //    The template has a single bold/red run: <w:t ...>MARÇO</w:t>
  //    We find the first (and only) occurrence of any Portuguese month name
  //    inside a <w:t> element and replace it with the selected month.
  const monthName = MONTHS_PT[monthNumber] ?? String(monthNumber);
  const allMonths = Object.values(MONTHS_PT).join('|');
  const monthRe = new RegExp(`(<w:t[^>]*>)(${allMonths})(<\\/w:t>)`);
  xml = xml.replace(monthRe, `$1${monthName}$3`);

  // 4. Find the activities block boundaries
  //    Start: the </w:tr> that closes the spacer row (height=71) right after the ATIVIDADES header
  //    End:   the first <w:tr> that contains "DECLARO TER FEITO"

  const spacerEnd = (() => {
    const spacerIdx = xml.indexOf('<w:trHeight w:val="71"');
    if (spacerIdx === -1) return -1;
    const trEndIdx = xml.indexOf('</w:tr>', spacerIdx);
    return trEndIdx === -1 ? -1 : trEndIdx + '</w:tr>'.length;
  })();

  const declaroStart = (() => {
    const declaroIdx = xml.indexOf('DECLARO TER FEITO');
    if (declaroIdx === -1) return -1;
    return xml.lastIndexOf('<w:tr>', declaroIdx);
  })();

  if (spacerEnd === -1 || declaroStart === -1) {
    throw new Error('Estrutura do template AVI não reconhecida. Verifique o arquivo template.');
  }

  // 5. Build replacement rows
  const activityRowsXml = services.length > 0
    ? services.map(s => buildActivityRow(s.description, s.date)).join('')
    : buildActivityRow('Nenhuma atividade registrada no período.', '');

  // 6. Splice the new rows in place of the old ones
  xml = xml.slice(0, spacerEnd) + activityRowsXml + xml.slice(declaroStart);

  // 7. Write back and generate output blob
  zip.file('word/document.xml', xml);

  const out = zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  return out as Blob;
}
