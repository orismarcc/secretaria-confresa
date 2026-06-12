/**
 * reportsPdf.ts — geração unificada de relatórios PDF da secretaria.
 * Usado pela Central de Relatórios (página de Análise).
 *
 * Mantém o mesmo padrão visual dos exports já existentes:
 * logo no topo, título verde, banda verde por grupo, zebra clara.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DEMAND_CATEGORIES } from '@/components/forms/DemandTypeForm';
import logoTransparent from '@/assets/logo-transparent.png';

// ─── Shared helpers ──────────────────────────────────────────────────────────

const GREEN: [number, number, number] = [45, 90, 39];

function categoryLabel(value: string | null | undefined): string {
  if (!value) return 'Sem categoria';
  return DEMAND_CATEGORIES.find(c => c.value === value)?.label ?? value;
}

function parseDate(d: string | null | undefined): Date | null {
  if (!d) return null;
  const date = new Date(d.includes('T') ? d : d.replace(' ', 'T'));
  return isNaN(date.getTime()) ? null : date;
}

function fmtDate(d: string | null | undefined): string {
  const date = parseDate(d);
  return date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : '-';
}

const statusLabel = (s: string) =>
  s === 'pending' ? 'Pendente'
  : s === 'in_progress' ? 'Em Execução'
  : s === 'proximo' ? 'Próximo'
  : 'Finalizado';

/** Loads the logo then runs the callback with header already drawn. Returns headerH. */
function withDocument(
  title: string,
  subtitle: string,
  build: (doc: jsPDF, headerH: number, pageWidth: number) => void,
  filename: string,
) {
  const img = new Image();
  img.onload = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    const logoW = 52;
    const logoH = logoW * (img.naturalHeight / img.naturalWidth);
    doc.addImage(img, 'PNG', 14, 6, logoW, logoH);

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GREEN);
    doc.text(title, pageWidth / 2, 16, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(
      `${subtitle} · Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      pageWidth / 2, 23, { align: 'center' },
    );

    const headerH = Math.max(logoH + 10, 32);
    doc.setDrawColor(200);
    doc.line(14, headerH, pageWidth - 14, headerH);
    doc.setTextColor(0);

    build(doc, headerH, pageWidth);
    doc.save(filename);
  };
  img.src = logoTransparent;
}

/** Draws a green section band; returns Y where content below should start. */
function sectionBand(doc: jsPDF, pageWidth: number, y: number, left: string, right: string): number {
  doc.setFillColor(...GREEN);
  doc.setTextColor(255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.rect(14, y, pageWidth - 28, 7, 'F');
  doc.text(` ${left}`, 14, y + 5);
  doc.text(right, pageWidth - 14, y + 5, { align: 'right' });
  doc.setTextColor(0);
  return y + 8;
}

// ─── Services report ─────────────────────────────────────────────────────────

export type ServicesReportStatus = 'all' | 'active' | 'completed';
export type ServicesReportGroupBy = 'none' | 'settlement' | 'category';

export interface ServicesReportOptions {
  services: any[];
  producers: any[];
  demandTypes: any[];
  settlements: any[];
  status: ServicesReportStatus;
  groupBy: ServicesReportGroupBy;
  /** 'all' or settlement id */
  settlementId: string;
  /** 'all' or category value */
  category: string;
}

export function generateServicesReport(opts: ServicesReportOptions) {
  const { services, producers, demandTypes, settlements, status, groupBy, settlementId, category } = opts;

  const dtById = new Map((demandTypes as any[]).map(d => [d.id, d]));
  const stById = new Map((settlements as any[]).map(s => [s.id, s]));
  const prById = new Map((producers as any[]).map(p => [p.id, p]));

  // Entregas têm fluxo próprio (página Entregas) — relatório de atendimentos as exclui,
  // espelhando o comportamento da página de Atendimentos.
  let rows = (services as any[]).filter(s => dtById.get(s.demand_type_id)?.category !== 'entregas');

  if (status === 'active') rows = rows.filter(s => s.status !== 'completed');
  if (status === 'completed') rows = rows.filter(s => s.status === 'completed');
  if (settlementId !== 'all') rows = rows.filter(s => s.settlement_id === settlementId);
  if (category !== 'all') rows = rows.filter(s => dtById.get(s.demand_type_id)?.category === category);

  const statusText = status === 'active' ? 'Ativos' : status === 'completed' ? 'Finalizados' : 'Todos';
  const subtitleBits = [`Atendimentos: ${statusText}`];
  if (settlementId !== 'all') subtitleBits.push(stById.get(settlementId)?.name ?? '');
  if (category !== 'all') subtitleBits.push(categoryLabel(category));
  const subtitle = subtitleBits.filter(Boolean).join(' · ');

  const toRow = (s: any) => [
    prById.get(s.producer_id)?.name || s.producers?.name || 'N/A',
    dtById.get(s.demand_type_id)?.name || s.demand_types?.name || 'N/A',
    stById.get(s.settlement_id)?.name || s.settlements?.name || '-',
    fmtDate(s.created_at),
    fmtDate(s.completed_at),
    statusLabel(s.status),
  ];
  const head = ['Produtor', 'Demanda', 'Assentamento', 'Cadastro', 'Finalização', 'Status'];

  const filename = `atendimentos-${status}-${groupBy}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

  withDocument('Relatório de Atendimentos', subtitle, (doc, headerH, pageWidth) => {
    if (groupBy === 'none') {
      autoTable(doc, {
        startY: headerH + 4,
        head: [head],
        body: rows.map(toRow),
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 250, 245] },
        margin: { left: 14, right: 14 },
      });
      return;
    }

    // Grouped
    const groups: Record<string, { label: string; rows: any[] }> = {};
    rows.forEach(s => {
      let key: string, label: string;
      if (groupBy === 'settlement') {
        key = s.settlement_id || '__none__';
        label = stById.get(s.settlement_id)?.name || s.settlements?.name || 'Sem assentamento';
      } else {
        const cat = dtById.get(s.demand_type_id)?.category ?? null;
        key = cat || '__none__';
        label = categoryLabel(cat);
      }
      if (!groups[key]) groups[key] = { label, rows: [] };
      groups[key].rows.push(s);
    });

    const sorted = Object.values(groups).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    let cursorY = headerH + 6;

    sorted.forEach(({ label, rows: groupRows }) => {
      if (cursorY > 250) { doc.addPage(); cursorY = 14; }
      const startY = sectionBand(doc, pageWidth, cursorY, label, `${groupRows.length} atendimento(s)`);
      autoTable(doc, {
        startY,
        head: [head],
        body: groupRows.map(toRow),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [237, 247, 237], textColor: GREEN, fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: [248, 252, 248] },
        margin: { left: 14, right: 14 },
      });
      cursorY = (doc as any).lastAutoTable.finalY + 6;
    });
  }, filename);
}

// ─── Producers report ────────────────────────────────────────────────────────

export interface ProducersReportOptions {
  producers: any[];
  settlements: any[];
  groupBy: 'none' | 'settlement';
  /** 'all' or settlement id */
  settlementId: string;
}

export function generateProducersReport(opts: ProducersReportOptions) {
  const { producers, settlements, groupBy, settlementId } = opts;
  const stById = new Map((settlements as any[]).map(s => [s.id, s]));

  let rows = [...(producers as any[])].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', 'pt-BR'),
  );
  if (settlementId !== 'all') rows = rows.filter(p => p.settlement_id === settlementId);

  const subtitle = settlementId !== 'all'
    ? `Produtores · ${stById.get(settlementId)?.name ?? ''}`
    : 'Todos os produtores cadastrados';

  const toRow = (p: any) => [
    p.name || 'N/A',
    p.cpf || '-',
    p.phone || '-',
    stById.get(p.settlement_id)?.name || '-',
    p.location_name || '-',
    p.caf || '-',
  ];
  const head = ['Nome', 'CPF', 'Telefone', 'Assentamento', 'Localidade', 'CAF'];

  const filename = `produtores-${groupBy}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

  withDocument('Relatório de Produtores', subtitle, (doc, headerH, pageWidth) => {
    if (groupBy === 'none') {
      autoTable(doc, {
        startY: headerH + 4,
        head: [head],
        body: rows.map(toRow),
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 250, 245] },
        margin: { left: 14, right: 14 },
      });
      return;
    }

    const groups: Record<string, { label: string; rows: any[] }> = {};
    rows.forEach(p => {
      const key = p.settlement_id || '__none__';
      const label = stById.get(p.settlement_id)?.name || 'Sem assentamento';
      if (!groups[key]) groups[key] = { label, rows: [] };
      groups[key].rows.push(p);
    });

    const sorted = Object.values(groups).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    let cursorY = headerH + 6;

    sorted.forEach(({ label, rows: groupRows }) => {
      if (cursorY > 250) { doc.addPage(); cursorY = 14; }
      const startY = sectionBand(doc, pageWidth, cursorY, label, `${groupRows.length} produtor(es)`);
      autoTable(doc, {
        startY,
        head: [head],
        body: groupRows.map(toRow),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [237, 247, 237], textColor: GREEN, fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: [248, 252, 248] },
        margin: { left: 14, right: 14 },
      });
      cursorY = (doc as any).lastAutoTable.finalY + 6;
    });
  }, filename);
}
