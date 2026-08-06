/**
 * comunicado.ts — geração do Comunicado Interno de emissão de DAM.
 * Preenche o modelo oficial (.docx em /templates/comunicado-dam.docx),
 * preservando exatamente fonte (Tahoma) e timbrado do documento original.
 */
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import jsPDF from 'jspdf';

// ─── Valor por extenso (pt-BR, BRL) ───────────────────────────────────────────

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

/** Converte um inteiro de 0 a 999 em extenso. */
function ate999(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (resto > 0) {
    if (resto < 10) partes.push(UNIDADES[resto]);
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u > 0 ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(' e ');
}

/** Converte um inteiro (0 a 999.999) em extenso. */
function inteiroPorExtenso(n: number): string {
  if (n === 0) return 'zero';
  const milhar = Math.floor(n / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (milhar > 0) {
    partes.push(milhar === 1 ? 'mil' : `${ate999(milhar)} mil`);
  }
  if (resto > 0) {
    // "e" antes da centena final quando resto < 100 ou múltiplo de 100
    if (milhar > 0 && (resto < 100 || resto % 100 === 0)) partes.push('e');
    partes.push(ate999(resto));
  }
  return partes.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Valor monetário por extenso no padrão do comunicado:
 * 112.50 → "cento e doze reais, e cinquenta centavos"
 */
export function valorPorExtenso(valor: number): string {
  const reais = Math.floor(Math.round(valor * 100) / 100);
  const centavos = Math.round((valor - reais) * 100);

  const parteReais = reais > 0
    ? `${inteiroPorExtenso(reais)} ${reais === 1 ? 'real' : 'reais'}`
    : '';
  const parteCentavos = centavos > 0
    ? `${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`
    : '';

  if (parteReais && parteCentavos) return `${parteReais}, e ${parteCentavos}`;
  if (parteReais) return parteReais;
  if (parteCentavos) return parteCentavos;
  return 'zero reais';
}

// ─── Formatações ───────────────────────────────────────────────────────────────

/** 1 → "1h00min" · 1.5 → "1h30min" */
export function formatHoras(horas: number): string {
  const h = Math.floor(horas);
  const min = Math.round((horas - h) * 60);
  return `${h}h${String(min).padStart(2, '0')}min`;
}

/** 15 → "15L" · 15.5 → "15,5L" */
export function formatLitros(litros: number): string {
  const s = Number.isInteger(litros)
    ? String(litros)
    : litros.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return `${s}L`;
}

/** 112.5 → "112,50" */
function formatBRLNumber(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** Data de emissão no formato "24 de junho de 2026" */
export function dataPorExtenso(d: Date): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

// ─── Geração do documento ──────────────────────────────────────────────────────

export interface ComunicadoData {
  numero: string;
  data: Date;
  tipo: string;        // tipo de demanda (ex.: "Pá Carregadeira")
  nome: string;
  cpf: string;
  horas: number;       // worked_hours
  litros: number;      // fuel_liters
  valorCombustivel: number; // R$ — valor total do combustível (já calculado)
  valorUpfm: number;        // R$
}

/**
 * Preenche o modelo .docx e dispara o download.
 * Total = combustível + UPFM.
 */
export async function gerarComunicadoDam(dados: ComunicadoData): Promise<void> {
  const total = dados.valorCombustivel + dados.valorUpfm;

  const resp = await fetch('/templates/comunicado-dam.docx');
  if (!resp.ok) throw new Error('Modelo do comunicado não encontrado.');
  const content = await resp.arrayBuffer();

  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

  doc.render({
    numero: dados.numero,
    data: dataPorExtenso(dados.data),
    tipo: (dados.tipo || '').toUpperCase(),
    nome: (dados.nome || '').toUpperCase(),
    cpf: dados.cpf,
    horas: formatHoras(dados.horas),
    litros: formatLitros(dados.litros),
    combustivel: formatBRLNumber(dados.valorCombustivel),
    combustivel_ext: valorPorExtenso(dados.valorCombustivel),
    upfm: formatBRLNumber(dados.valorUpfm),
    upfm_ext: valorPorExtenso(dados.valorUpfm),
    total: formatBRLNumber(total),
    total_ext: valorPorExtenso(total),
  });

  const blob = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const nomeArq = (dados.nome || 'produtor').replace(/[^\p{L}\s]/gu, '').trim().replace(/\s+/g, '-');
  a.download = `Comunicado-DAM-${nomeArq}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Geração em PDF (mesmo conteúdo e timbrado do modelo) ────────────────────────

function u8ToBase64(u8: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

/**
 * Gera o comunicado em PDF (alternativa ao .docx). Reaproveita o timbrado do
 * modelo oficial (cabeçalho e rodapé) e replica o texto do documento.
 */
export async function gerarComunicadoDamPdf(dados: ComunicadoData): Promise<void> {
  const total = dados.valorCombustivel + dados.valorUpfm;

  // Reaproveita o timbrado (cabeçalho e rodapé) do modelo .docx.
  const resp = await fetch('/templates/comunicado-dam.docx');
  if (!resp.ok) throw new Error('Modelo do comunicado não encontrado.');
  const zip = new PizZip(await resp.arrayBuffer());
  const headerImg = zip.file('word/media/image4.png');
  const footerImg = zip.file('word/media/image1.jpg');
  const headerB64 = headerImg ? 'data:image/png;base64,' + u8ToBase64(headerImg.asUint8Array()) : null;
  const footerB64 = footerImg ? 'data:image/jpeg;base64,' + u8ToBase64(footerImg.asUint8Array()) : null;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Timbrado (largura total, proporções do modelo)
  const headerH = W * (866775 / 7629525); // ≈ 67.6 pt
  const footerH = W * (893326 / 7556500); // ≈ 70.3 pt
  if (headerB64) { try { doc.addImage(headerB64, 'PNG', 0, 14, W, headerH, undefined, 'FAST'); } catch { /* ignora */ } }
  if (footerB64) { try { doc.addImage(footerB64, 'JPEG', 0, H - footerH - 6, W, footerH, undefined, 'FAST'); } catch { /* ignora */ } }

  const mL = 42, mR = 42, cW = W - mL - mR;
  const bottomLimit = H - footerH - 18;
  let y = 14 + headerH + 26;

  const setFont = (bold: boolean) => doc.setFont('helvetica', bold ? 'bold' : 'normal');
  const ensure = (h: number) => { if (y + h > bottomLimit) { doc.addPage(); y = 40; } };

  const para = (
    text: string,
    opts: { bold?: boolean; justify?: boolean; center?: boolean; size?: number; gap?: number } = {},
  ) => {
    const size = opts.size ?? 10.5;
    const lh = size * 1.42;
    doc.setFontSize(size); setFont(!!opts.bold); doc.setTextColor(25);
    const lines = doc.splitTextToSize(text, cW) as string[];
    lines.forEach((ln, i) => {
      ensure(lh);
      if (opts.center) doc.text(ln, W / 2, y, { align: 'center' });
      else if (opts.justify && i < lines.length - 1) doc.text(ln, mL, y, { align: 'justify', maxWidth: cW });
      else doc.text(ln, mL, y);
      y += lh;
    });
    y += opts.gap ?? 7;
  };

  const labeled = (label: string, value: string) => {
    const lh = 10.5 * 1.42;
    ensure(lh);
    doc.setFontSize(10.5); doc.setTextColor(25);
    setFont(false);
    doc.text(label + ' ', mL, y);
    const lw = doc.getTextWidth(label + ' ');
    setFont(true);
    doc.text(String(value), mL + lw, y);
    y += lh + 1.5;
  };

  // ── Corpo ──
  para(`COMUNICADO INTERNO Nº ${dados.numero} / SECRETARIA DE AGRICULTURA`, { bold: true, center: true, size: 12, gap: 4 });
  para(`Confresa/MT, ${dataPorExtenso(dados.data)}.`, { size: 10.5, gap: 12 });
  para('AO SETOR DE TRIBUTOS', { bold: true, gap: 6 });
  para(
    `ASSUNTO: SOLICITAÇÃO DE EMISSÃO DE DAM – DOCUMENTO DE ARRECADAÇÃO MUNICIPAL PARA ATENDIMENTO COM ${(dados.tipo || '').toUpperCase()} A PRODUTOR RURAL`,
    { bold: true, justify: true, gap: 10 },
  );
  para(
    'Venho por meio deste encaminhar os dados do produtor rural abaixo relacionado, devidamente autorizado por esta Secretaria Municipal de Agricultura, para fins de emissão do DAM – Documento de Arrecadação Municipal, pelo setor tributário municipal, conforme procedimentos adotados para prestação de serviços com uso de máquinas e/ou veículos:',
    { justify: true, gap: 8 },
  );
  para('Dados do Produtor Rural:', { bold: true, gap: 4 });
  labeled('Nome Completo:', (dados.nome || '').toUpperCase());
  labeled('CPF:', dados.cpf || '—');
  labeled('Tempo estimado de uso de máquina e/ou veículo:', formatHoras(dados.horas));
  labeled('Quantidade estimada de combustível:', formatLitros(dados.litros));
  y += 4;
  para(
    'Informamos que o produtor rural deverá recolher a taxa correspondente a 1 (uma) Unidade Padrão Fiscal Municipal (UPFM), conforme cotação vigente na data, sem acréscimo dos valores referentes ao combustível necessário, pois o produtor detém na propriedade a quantidade necessária para o serviço, considerando o limite de até 6 (seis) horas para a execução dos serviços, conforme disposto abaixo:',
    { justify: true, gap: 8 },
  );
  para(`Combustível: R$ ${formatBRLNumber(dados.valorCombustivel)} (${valorPorExtenso(dados.valorCombustivel)});`, { gap: 4 });
  para(`Taxa referente a 1 UPFM: R$ ${formatBRLNumber(dados.valorUpfm)} (${valorPorExtenso(dados.valorUpfm)});`, { gap: 4 });
  para(`Total: R$ ${formatBRLNumber(total)} (${valorPorExtenso(total)})`, { bold: true, gap: 10 });
  para(
    'Prazo de pagamento: 30 (trinta) dias. A inserção do atendimento ao cronograma de serviços fica condicionado à comprovação do recolhimento.',
    { justify: true, gap: 30 },
  );

  // Assinatura
  ensure(50);
  para('_______________________________', { center: true, gap: 2 });
  para('CASSIO RODRIGUES DA COSTA', { bold: true, center: true, gap: 1 });
  para('SECRETÁRIO DE AGRICULTURA', { center: true, gap: 0 });

  const nomeArq = (dados.nome || 'produtor').replace(/[^\p{L}\s]/gu, '').trim().replace(/\s+/g, '-');
  doc.save(`Comunicado-DAM-${nomeArq}.pdf`);
}
