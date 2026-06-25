/**
 * comunicado.ts — geração do Comunicado Interno de emissão de DAM.
 * Preenche o modelo oficial (.docx em /templates/comunicado-dam.docx),
 * preservando exatamente fonte (Tahoma) e timbrado do documento original.
 */
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

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
