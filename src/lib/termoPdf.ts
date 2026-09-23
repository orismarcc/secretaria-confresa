/**
 * termoPdf.ts — Termo de Responsabilidade padronizado de cessão de veículo a um
 * condutor (servidor). Gera um PDF pronto para impressão/assinatura, vinculando
 * veículo ↔ condutor. Não grava nada: apenas monta e baixa o documento.
 */
import jsPDF from 'jspdf';
import { triggerDownload, dataPorExtenso } from '@/lib/comunicado';

export interface TermoPdfData {
  veiculo: string;
  patrimonio?: string | null;
  placa?: string | null;
  condutor: string;
  cpf?: string | null;
  matricula?: string | null;
  cnh?: string | null;
  cnhCategoria?: string | null;
  origem?: string | null;     // "Cidade/UF"
  destino?: string | null;    // "Cidade/UF"
  dataInicio?: string | null; // yyyy-mm-dd
  dataFim?: string | null;
  finalidade?: string | null;
  observacao?: string | null;
}

function fmtData(iso?: string | null): string {
  if (!iso) return '____/____/________';
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  return d.toLocaleDateString('pt-BR');
}

function nomeArquivo(s: string): string {
  return (s || 'termo').replace(/[^\p{L}\s]/gu, '').trim().replace(/\s+/g, '-');
}

export function buildTermoResponsabilidadePdf(d: TermoPdfData): { blob: Blob; filename: string } {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const mL = 48, mR = 48, cW = W - mL - mR;
  let y = 56;

  const setFont = (bold: boolean) => doc.setFont('helvetica', bold ? 'bold' : 'normal');
  const ensure = (h: number) => { if (y + h > H - 60) { doc.addPage(); y = 56; } };
  const para = (text: string, opts: { bold?: boolean; center?: boolean; size?: number; gap?: number; justify?: boolean } = {}) => {
    const size = opts.size ?? 11;
    const lh = size * 1.5;
    doc.setFontSize(size); setFont(!!opts.bold); doc.setTextColor(25);
    const lines = doc.splitTextToSize(text, cW) as string[];
    lines.forEach((ln, i) => {
      ensure(lh);
      if (opts.center) doc.text(ln, W / 2, y, { align: 'center' });
      else if (opts.justify && i < lines.length - 1) doc.text(ln, mL, y, { align: 'justify', maxWidth: cW });
      else doc.text(ln, mL, y);
      y += lh;
    });
    y += opts.gap ?? 8;
  };
  const labeled = (label: string, value: string) => {
    const lh = 11 * 1.5;
    ensure(lh);
    doc.setFontSize(11); doc.setTextColor(25); setFont(false);
    doc.text(label + ' ', mL, y);
    const lw = doc.getTextWidth(label + ' ');
    setFont(true);
    doc.text(doc.splitTextToSize(String(value), cW - lw) as string[], mL + lw, y);
    y += lh + 2;
  };

  // Cabeçalho
  para('PREFEITURA MUNICIPAL DE CONFRESA – MT', { bold: true, center: true, size: 12, gap: 2 });
  para('SECRETARIA MUNICIPAL DE AGRICULTURA', { bold: true, center: true, size: 11, gap: 16 });
  para('TERMO DE RESPONSABILIDADE E CESSÃO DE VEÍCULO', { bold: true, center: true, size: 13, gap: 16 });

  // Identificação do veículo
  para('1. IDENTIFICAÇÃO DO VEÍCULO', { bold: true, size: 11, gap: 4 });
  labeled('Veículo:', (d.veiculo || '—').toUpperCase());
  if (d.placa) labeled('Placa:', d.placa.toUpperCase());
  if (d.patrimonio) labeled('Patrimônio nº:', String(d.patrimonio));
  y += 4;

  // Identificação do condutor
  para('2. IDENTIFICAÇÃO DO CONDUTOR', { bold: true, size: 11, gap: 4 });
  labeled('Nome:', (d.condutor || '—').toUpperCase());
  if (d.cpf) labeled('CPF:', d.cpf);
  if (d.matricula) labeled('Matrícula:', d.matricula);
  if (d.cnh) labeled('CNH nº:', `${d.cnh}${d.cnhCategoria ? ` — Categoria ${d.cnhCategoria}` : ''}`);
  y += 4;

  // Período e finalidade
  para('3. TRAJETO, PERÍODO E FINALIDADE', { bold: true, size: 11, gap: 4 });
  labeled('Local de saída:', d.origem || '______________________ / ____');
  labeled('Destino:', d.destino || '______________________ / ____');
  labeled('Período de cessão:', `${fmtData(d.dataInicio)} a ${fmtData(d.dataFim)}`);
  if (d.finalidade) labeled('Finalidade:', d.finalidade);
  y += 6;

  // Cláusulas
  para('4. DECLARAÇÃO E RESPONSABILIDADES', { bold: true, size: 11, gap: 4 });
  para(
    `Pelo presente Termo, o condutor acima identificado declara ter recebido, sob sua inteira responsabilidade, o veículo descrito no item 1, comprometendo-se a:`,
    { justify: true, gap: 6 },
  );
  para('a) utilizá-lo exclusivamente em serviço e interesse da Administração Pública, no período e finalidade indicados;', { justify: true, gap: 4 });
  para('b) conduzi-lo portando Carteira Nacional de Habilitação válida e compatível, observando integralmente a legislação de trânsito;', { justify: true, gap: 4 });
  para('c) responder, na forma da lei, por infrações de trânsito, multas e danos causados por dolo, imprudência, negligência ou imperícia durante o período de cessão;', { justify: true, gap: 4 });
  para('d) zelar pela conservação, guarda e adequada utilização do veículo, comunicando imediatamente à Secretaria quaisquer avarias, sinistros ou irregularidades;', { justify: true, gap: 4 });
  para('e) devolver o veículo nas mesmas condições em que o recebeu, ressalvado o desgaste natural de uso.', { justify: true, gap: 8 });

  if (d.observacao) {
    para('5. OBSERVAÇÕES', { bold: true, size: 11, gap: 4 });
    para(d.observacao, { justify: true, gap: 8 });
  }

  // Data e assinaturas
  y += 10;
  ensure(120);
  para(`Confresa/MT, ${dataPorExtenso(new Date())}.`, { gap: 40 });

  const colW = cW / 2 - 20;
  const x1 = mL + colW / 2;
  const x2 = mL + cW - colW / 2;
  ensure(60);
  doc.setDrawColor(60);
  doc.line(mL, y, mL + colW, y);
  doc.line(mL + cW - colW, y, mL + cW, y);
  y += 14;
  doc.setFontSize(10); setFont(true); doc.setTextColor(25);
  doc.text((d.condutor || 'Condutor').toUpperCase(), x1, y, { align: 'center' });
  doc.text('SECRETARIA DE AGRICULTURA', x2, y, { align: 'center' });
  y += 13;
  doc.setFontSize(9); setFont(false); doc.setTextColor(90);
  doc.text('Condutor responsável', x1, y, { align: 'center' });
  doc.text('Cedente', x2, y, { align: 'center' });

  return { blob: doc.output('blob'), filename: `Termo-Responsabilidade-${nomeArquivo(d.condutor)}.pdf` };
}

export function gerarTermoResponsabilidadePdf(d: TermoPdfData): void {
  const { blob, filename } = buildTermoResponsabilidadePdf(d);
  triggerDownload(blob, filename);
}
