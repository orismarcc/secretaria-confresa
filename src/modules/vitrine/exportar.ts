// Conecta Confresa — exportação (PDF e planilha) no padrão visual dos demais
// relatórios do sistema (logo, verde institucional, zebra clara).
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import logoTransparent from '@/assets/logo-transparent.png';
import { MESES, fmtNum, fmtBRL } from './constants';

const GREEN: [number, number, number] = [45, 90, 39];

export interface LinhaOferta {
  fornecedor: string;
  situacao: string;
  assentamento: string;
  produto: string;
  variedade: string;
  qtd: number | null;
  unidade: string;
  periodo: string;
  preco: number | null;
  entregue: boolean;
  frequencia: string;
  entregaPropria: string;
  emiteNota: string;
  distanciaKm: number | null;
}

export interface LinhaCalendario {
  produto: string;
  unidade: string;
  porMes: number[]; // 12 posições
}

const slugData = () => format(new Date(), 'yyyy-MM-dd');

function carregarLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = logoTransparent;
  });
}

async function cabecalho(doc: jsPDF, titulo: string, subtitulo: string): Promise<number> {
  const W = doc.internal.pageSize.getWidth();
  const img = await carregarLogo();
  let h = 24;
  if (img) {
    const lw = 46;
    const lh = lw * (img.naturalHeight / img.naturalWidth);
    // 'FAST' comprime a imagem (sem isso a logo sozinha deixa o PDF com ~1 MB).
    doc.addImage(img, 'PNG', 12, 6, lw, lh, undefined, 'FAST');
    h = Math.max(lh + 8, 26);
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.text(titulo, W / 2, 14, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90);
  doc.text(doc.splitTextToSize(subtitulo, W - 120) as string[], W / 2, 20, { align: 'center' });
  doc.setFontSize(7.5); doc.setTextColor(130);
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, W / 2, 26, { align: 'center' });
  doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(12, h, W - 12, h);
  return h + 6;
}

function rodape(doc: jsPDF) {
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setFontSize(7); doc.setTextColor(150);
    doc.text(`Conecta Confresa · Secretaria de Agricultura de Confresa/MT · Página ${p} de ${n}`,
      doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' });
  }
}

/** PDF (paisagem) com o resultado da busca de ofertas. */
export async function exportarOfertasPdf(linhas: LinhaOferta[], filtros: string, resumo: string) {
  const doc = new jsPDF({ orientation: 'landscape' });
  let y = await cabecalho(doc, 'Conecta Confresa — Ofertas da Agricultura Familiar', filtros);
  doc.setFontSize(9); doc.setTextColor(40); doc.setFont('helvetica', 'bold');
  doc.text(resumo, 12, y); y += 4;
  autoTable(doc, {
    startY: y,
    head: [['Fornecedor', 'Situação', 'Assentamento', 'Produto', 'Qtd/mês', 'Período', 'Preço', 'Entrega', 'Nota', 'Dist. sede*']],
    body: linhas.map((l) => [
      l.fornecedor, l.situacao, l.assentamento,
      l.variedade ? `${l.produto} — ${l.variedade}` : l.produto,
      l.qtd != null ? `${fmtNum(l.qtd)} ${l.unidade}` : '—',
      l.periodo,
      l.preco != null ? `${fmtBRL(l.preco)}/${l.unidade}${l.entregue ? ' (entregue)' : ''}` : '—',
      [l.frequencia, l.entregaPropria].filter(Boolean).join(' · ') || '—',
      l.emiteNota || '—',
      l.distanciaKm != null ? `${fmtNum(Math.round(l.distanciaKm))} km` : '—',
    ]),
    styles: { fontSize: 7.5, cellPadding: 1.6 },
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [245, 250, 245] },
    margin: { left: 12, right: 12 },
  });
  const fy = (doc as any).lastAutoTable.finalY + 5;
  doc.setFontSize(6.8); doc.setTextColor(120); doc.setFont('helvetica', 'normal');
  doc.text('* Distância em linha reta a partir do centro de Confresa. Informações declaradas pelos produtores — subsídio ao planejamento, não substituem os procedimentos formais de compra e pesquisa de preços.', 12, Math.min(fy, doc.internal.pageSize.getHeight() - 12), { maxWidth: doc.internal.pageSize.getWidth() - 24 });
  rodape(doc);
  doc.save(`conecta-confresa-ofertas-${slugData()}.pdf`);
}

/** Planilha com o resultado da busca de ofertas. */
export function exportarOfertasXlsx(linhas: LinhaOferta[]) {
  const aoa: (string | number | null)[][] = [[
    'Fornecedor', 'Situação', 'Assentamento', 'Produto', 'Variedade', 'Qtd/mês', 'Unidade', 'Período',
    'Preço (R$)', 'Preço com entrega', 'Frequência', 'Entrega própria', 'Emite nota', 'Distância da sede (km, linha reta)',
  ]];
  linhas.forEach((l) => aoa.push([
    l.fornecedor, l.situacao, l.assentamento, l.produto, l.variedade, l.qtd, l.unidade, l.periodo,
    l.preco, l.preco != null ? (l.entregue ? 'Sim' : 'Não') : null, l.frequencia, l.entregaPropria, l.emiteNota,
    l.distanciaKm != null ? Math.round(l.distanciaKm * 10) / 10 : null,
  ]));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [28, 12, 22, 18, 14, 10, 9, 14, 10, 10, 12, 10, 10, 14].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Ofertas');
  XLSX.writeFile(wb, `conecta-confresa-ofertas-${slugData()}.xlsx`);
}

/** Planilha do calendário (produto × mês, total disponível). */
export function exportarCalendarioXlsx(linhas: LinhaCalendario[], titulo: string) {
  const aoa: (string | number | null)[][] = [[titulo], [], ['Produto', 'Unidade', ...MESES]];
  linhas.forEach((l) => aoa.push([l.produto, l.unidade, ...l.porMes.map((v) => (v > 0 ? v : null))]));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 26 }, { wch: 9 }, ...MESES.map(() => ({ wch: 9 }))];
  XLSX.utils.book_append_sheet(wb, ws, 'Calendário');
  XLSX.writeFile(wb, `conecta-confresa-calendario-${slugData()}.xlsx`);
}
