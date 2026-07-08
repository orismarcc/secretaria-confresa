/**
 * executiveReportPdf.ts — Relatório Executivo (PDF) da secretaria.
 *
 * Um relatório "bonito" para mostrar o trabalho realizado: cabeçalho com logo,
 * caixas de indicadores (KPIs), gráfico de barras (vetorial, desenhado direto no
 * PDF — sem depender de captura de tela) e tabelas detalhadas.
 *
 * Filtra por TIPO (categoria de atendimento ou "Entregas") e por ASSENTAMENTO
 * (todos ou apenas um). Considera apenas trabalho FINALIZADO — o que foi feito.
 *
 * Mantém o mesmo padrão visual dos demais exports (verde institucional, logo no
 * topo, zebra clara). É um módulo isolado para não afetar reportsPdf.ts.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, subMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DEMAND_CATEGORIES } from '@/components/forms/DemandTypeForm';
import logoTransparent from '@/assets/logo-transparent.png';

type RGB = [number, number, number];

const GREEN: RGB = [45, 90, 39];
const BLUE: RGB = [37, 99, 235];
const AMBER: RGB = [217, 119, 6];

function categoryLabel(value: string | null | undefined): string {
  if (!value) return 'Sem categoria';
  return DEMAND_CATEGORIES.find((c) => c.value === value)?.label ?? value;
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

const fmtInt = (n: number) => n.toLocaleString('pt-BR');
const fmtDec = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Arredonda o topo do eixo para um número "redondo" (5, 10, 20, 50, 100...). */
function niceCeil(v: number): number {
  if (v <= 5) return 5;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return m * pow;
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface ExecutiveReportOptions {
  services: any[];
  deliveries: any[];
  producers: any[];
  demandTypes: any[];
  settlements: any[];
  /** 'all' | categoria de atendimento | 'entregas' */
  category: string;
  /** 'all' | id do assentamento */
  settlementId: string;
  /** 'all' | id do lote (projeto) — só se aplica quando category = 'entregas' */
  deliveryLotId?: string;
}

// ─── Bar chart (vetorial) ──────────────────────────────────────────────────────

interface BarSeries {
  name: string;
  color: RGB;
  data: number[];
}

function drawBarChart(
  doc: jsPDF,
  box: { x: number; y: number; w: number; h: number },
  categories: string[],
  series: BarSeries[],
) {
  const { x, y, w, h } = box;
  const n = categories.length || 1;
  const maxVal = Math.max(1, ...series.flatMap((s) => s.data));
  const axisMax = niceCeil(maxVal);
  const bottom = y + h;

  // Linhas de grade horizontais + rótulos do eixo Y (0, meio, topo)
  doc.setLineWidth(0.2);
  [0, 0.5, 1].forEach((f) => {
    const gy = bottom - f * h;
    doc.setDrawColor(f === 0 ? 200 : 234);
    doc.line(x, gy, x + w, gy);
    doc.setFontSize(6.5);
    doc.setTextColor(150);
    doc.text(fmtInt(Math.round(axisMax * f)), x - 2, gy + 1.5, { align: 'right' });
  });

  const groupW = w / n;
  const gap = groupW * 0.16;
  const innerW = groupW - gap * 2;
  const barW = innerW / series.length;

  categories.forEach((cat, i) => {
    const gx = x + i * groupW + gap;
    series.forEach((s, si) => {
      const val = s.data[i] || 0;
      const bh = (val / axisMax) * h;
      const bx = gx + si * barW;
      doc.setFillColor(s.color[0], s.color[1], s.color[2]);
      doc.rect(bx, bottom - bh, barW * 0.86, bh, 'F');
      if (val > 0) {
        doc.setFontSize(5.8);
        doc.setTextColor(90);
        doc.text(fmtInt(val), bx + (barW * 0.86) / 2, bottom - bh - 1.4, { align: 'center' });
      }
    });
    doc.setFontSize(6.5);
    doc.setTextColor(110);
    doc.text(cat, x + i * groupW + groupW / 2, bottom + 4, { align: 'center' });
  });

  // Legenda (só quando há mais de uma série)
  if (series.length > 1) {
    let lx = x;
    const ly = bottom + 9;
    series.forEach((s) => {
      doc.setFillColor(s.color[0], s.color[1], s.color[2]);
      doc.rect(lx, ly - 2.6, 3, 3, 'F');
      doc.setFontSize(7);
      doc.setTextColor(80);
      doc.text(s.name, lx + 4.5, ly);
      lx += 5 + doc.getTextWidth(s.name) + 8;
    });
  }
}

// ─── KPI boxes ─────────────────────────────────────────────────────────────────

interface Kpi {
  label: string;
  value: string;
  color: RGB;
}

function drawKpis(doc: jsPDF, x: number, y: number, w: number, kpis: Kpi[]): number {
  const perRow = kpis.length <= 3 ? kpis.length : kpis.length === 4 ? 4 : 3;
  const gap = 4;
  const boxW = (w - gap * (perRow - 1)) / perRow;
  const boxH = 20;
  let cy = y;
  kpis.forEach((k, i) => {
    const col = i % perRow;
    if (col === 0 && i > 0) cy += boxH + gap;
    const bx = x + col * (boxW + gap);
    doc.setDrawColor(224);
    doc.setFillColor(250, 251, 250);
    doc.roundedRect(bx, cy, boxW, boxH, 2, 2, 'FD');
    // barra de cor à esquerda
    doc.setFillColor(k.color[0], k.color[1], k.color[2]);
    doc.rect(bx, cy, 1.6, boxH, 'F');
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(k.color[0], k.color[1], k.color[2]);
    doc.text(k.value, bx + 5, cy + 10);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110);
    doc.text(k.label.toUpperCase(), bx + 5, cy + 16);
  });
  return cy + boxH;
}

function sectionTitle(doc: jsPDF, x: number, y: number, text: string): number {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.text(text, x, y);
  doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.setLineWidth(0.4);
  doc.line(x, y + 1.5, x + 40, y + 1.5);
  doc.setTextColor(0);
  return y + 7;
}

// ─── Delivery quantity helper (itens sem dupla contagem) ───────────────────────

function deliveryQty(d: any, lotId?: string): number {
  const items = (d.delivery_items ?? []) as any[];
  const rel = lotId && lotId !== 'all' ? items.filter((it) => it.lot_id === lotId) : items;
  if (rel.length > 0) return rel.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  // Sem itens: só usa o campo direto quando não há filtro de lote
  return lotId && lotId !== 'all' ? 0 : Number(d.quantity) || 0;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export function generateExecutiveReport(opts: ExecutiveReportOptions) {
  const { services, deliveries, producers, demandTypes, settlements, category, settlementId } = opts;
  const deliveryLotId = opts.deliveryLotId ?? 'all';

  const dtById = new Map((demandTypes as any[]).map((d) => [d.id, d]));
  const stById = new Map((settlements as any[]).map((s) => [s.id, s]));
  const prById = new Map((producers as any[]).map((p) => [p.id, p]));

  // Nome do lote (projeto) a partir dos itens das entregas
  const lotNameById = new Map<string, string>();
  (deliveries as any[]).forEach((d) =>
    ((d.delivery_items ?? []) as any[]).forEach((it) => {
      if (it.lot_id && it.delivery_lots?.name) lotNameById.set(it.lot_id, it.delivery_lots.name);
    }),
  );
  const lotFilterName = deliveryLotId !== 'all' ? lotNameById.get(deliveryLotId) : null;

  const settlementName = (id: string | null | undefined, embedded?: any) =>
    stById.get(id)?.name || embedded?.name || 'Sem assentamento';

  const includeServices = category === 'all' || category !== 'entregas';
  const includeDeliveries = category === 'all' || category === 'entregas';

  // ── Filtragem — apenas FINALIZADO ─────────────────────────────────────────
  let compServices = includeServices
    ? (services as any[]).filter(
        (s) => s.status === 'completed' && dtById.get(s.demand_type_id)?.category !== 'entregas',
      )
    : [];
  if (category !== 'all' && category !== 'entregas') {
    compServices = compServices.filter((s) => dtById.get(s.demand_type_id)?.category === category);
  }
  if (settlementId !== 'all') compServices = compServices.filter((s) => s.settlement_id === settlementId);

  let compDeliveries = includeDeliveries
    ? (deliveries as any[]).filter((d) => d.status === 'completed')
    : [];
  if (settlementId !== 'all') compDeliveries = compDeliveries.filter((d) => d.settlement_id === settlementId);
  if (deliveryLotId !== 'all') {
    compDeliveries = compDeliveries.filter((d) =>
      ((d.delivery_items ?? []) as any[]).some((it) => it.lot_id === deliveryLotId),
    );
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const itensEntregues = compDeliveries.reduce((s, d) => s + deliveryQty(d, deliveryLotId), 0);
  const areaTrabalhada = compServices.reduce((s, x) => s + (Number(x.worked_area) || 0), 0);
  const produtoresSet = new Set<string>();
  compServices.forEach((s) => s.producer_id && produtoresSet.add(s.producer_id));
  compDeliveries.forEach((d) => d.producer_id && produtoresSet.add(d.producer_id));

  const kpis: Kpi[] = [];
  if (includeServices) kpis.push({ label: 'Atendimentos finalizados', value: fmtInt(compServices.length), color: GREEN });
  if (includeDeliveries) {
    kpis.push({ label: 'Entregas realizadas', value: fmtInt(compDeliveries.length), color: BLUE });
    kpis.push({ label: 'Itens entregues', value: fmtInt(itensEntregues), color: BLUE });
  }
  kpis.push({ label: 'Produtores atendidos', value: fmtInt(produtoresSet.size), color: AMBER });
  if (includeServices && areaTrabalhada > 0)
    kpis.push({ label: 'Área trabalhada (ha)', value: fmtDec(areaTrabalhada), color: AMBER });

  // ── Série mensal (últimos 12 meses) ───────────────────────────────────────
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const md = subMonths(now, 11 - i);
    return {
      key: format(startOfMonth(md), 'yyyy-MM'),
      label: format(md, 'MMM/yy', { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase()),
    };
  });
  const countByMonth = (rows: any[]) => {
    const map: Record<string, number> = {};
    rows.forEach((r) => {
      const d = parseDate(r.completed_at);
      if (!d) return;
      const k = format(startOfMonth(d), 'yyyy-MM');
      map[k] = (map[k] || 0) + 1;
    });
    return months.map((m) => map[m.key] || 0);
  };

  const chartSeries: BarSeries[] = [];
  if (includeServices) chartSeries.push({ name: 'Atendimentos', color: GREEN, data: countByMonth(compServices) });
  if (includeDeliveries) chartSeries.push({ name: 'Entregas', color: BLUE, data: countByMonth(compDeliveries) });

  // ── Subtítulo ─────────────────────────────────────────────────────────────
  const filtroTipo =
    category === 'all' ? 'Todos os tipos' : category === 'entregas' ? 'Entregas' : categoryLabel(category);
  const filtroAssent = settlementId !== 'all' ? settlementName(settlementId) : 'Todos os assentamentos';
  const subtitle = [filtroTipo, lotFilterName, filtroAssent].filter(Boolean).join(' · ');

  // ── Montagem do documento ─────────────────────────────────────────────────
  const img = new Image();
  img.onload = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const M = 14;
    const contentW = pageWidth - M * 2;

    // Cabeçalho
    const logoW = 52;
    const logoH = logoW * (img.naturalHeight / img.naturalWidth);
    doc.addImage(img, 'PNG', M, 6, logoW, logoH);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
    doc.text('Relatório de Atividades', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90);
    doc.text(subtitle, pageWidth / 2, 21, { align: 'center' });
    doc.setFontSize(7.5);
    doc.setTextColor(130);
    doc.text(
      `Trabalho realizado (finalizado) · Gerado em ${format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      pageWidth / 2,
      26,
      { align: 'center' },
    );
    const headerH = Math.max(logoH + 8, 30);
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(M, headerH, pageWidth - M, headerH);

    // KPIs
    let y = sectionTitle(doc, M, headerH + 8, 'Resumo');
    y = drawKpis(doc, M, y + 1, contentW, kpis) + 8;

    // Gráfico mensal
    if (chartSeries.some((s) => s.data.some((v) => v > 0))) {
      y = sectionTitle(doc, M, y, 'Produção por mês (últimos 12 meses)');
      drawBarChart(doc, { x: M + 8, y: y + 2, w: contentW - 10, h: 42 }, months.map((m) => m.label), chartSeries);
      y += 2 + 42 + (chartSeries.length > 1 ? 13 : 8);
    }

    // Resumo por assentamento (só quando "Todos")
    if (settlementId === 'all') {
      const agg: Record<string, { name: string; atend: number; entregas: number; itens: number; prod: Set<string> }> = {};
      const bump = (id: string | null, embedded: any) => {
        const key = id || '__none__';
        if (!agg[key]) agg[key] = { name: settlementName(id, embedded), atend: 0, entregas: 0, itens: 0, prod: new Set() };
        return agg[key];
      };
      compServices.forEach((s) => {
        const g = bump(s.settlement_id, s.settlements);
        g.atend++;
        if (s.producer_id) g.prod.add(s.producer_id);
      });
      compDeliveries.forEach((d) => {
        const g = bump(d.settlement_id, d.settlements);
        g.entregas++;
        g.itens += deliveryQty(d, deliveryLotId);
        if (d.producer_id) g.prod.add(d.producer_id);
      });
      const rows = Object.values(agg)
        .sort((a, b) => b.atend + b.entregas - (a.atend + a.entregas))
        .map((g) => [
          g.name,
          ...(includeServices ? [fmtInt(g.atend)] : []),
          ...(includeDeliveries ? [fmtInt(g.entregas), fmtInt(g.itens)] : []),
          fmtInt(g.prod.size),
        ]);
      if (rows.length > 0) {
        if (y > 235) { doc.addPage(); y = 16; }
        y = sectionTitle(doc, M, y, 'Resumo por assentamento');
        autoTable(doc, {
          startY: y,
          head: [[
            'Assentamento',
            ...(includeServices ? ['Atend.'] : []),
            ...(includeDeliveries ? ['Entregas', 'Itens'] : []),
            'Produtores',
          ]],
          body: rows,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 8 },
          alternateRowStyles: { fillColor: [245, 250, 245] },
          columnStyles: { 0: { cellWidth: 'auto' } },
          margin: { left: M, right: M },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }
    }

    // Detalhe: atendimentos finalizados
    if (includeServices && compServices.length > 0) {
      if (y > 245) { doc.addPage(); y = 16; }
      y = sectionTitle(doc, M, y, `Atendimentos finalizados (${compServices.length})`);
      const body = compServices
        .slice()
        .sort((a, b) => (parseDate(b.completed_at)?.getTime() || 0) - (parseDate(a.completed_at)?.getTime() || 0))
        .map((s) => [
          prById.get(s.producer_id)?.name || s.producers?.name || 'N/A',
          dtById.get(s.demand_type_id)?.name || s.demand_types?.name || 'N/A',
          settlementName(s.settlement_id, s.settlements),
          s.worked_area ? `${fmtDec(Number(s.worked_area))} ha` : '-',
          fmtDate(s.completed_at),
        ]);
      autoTable(doc, {
        startY: y,
        head: [['Produtor', 'Demanda', 'Assentamento', 'Área', 'Finalizado']],
        body,
        styles: { fontSize: 7.5, cellPadding: 1.8 },
        headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: [245, 250, 245] },
        margin: { left: M, right: M },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Detalhe: entregas realizadas
    if (includeDeliveries && compDeliveries.length > 0) {
      if (y > 245) { doc.addPage(); y = 16; }
      y = sectionTitle(doc, M, y, `Entregas realizadas (${compDeliveries.length})`);
      const body = compDeliveries
        .slice()
        .sort((a, b) => (parseDate(b.completed_at)?.getTime() || 0) - (parseDate(a.completed_at)?.getTime() || 0))
        .map((d) => {
          const lotes = ((d.delivery_items ?? []) as any[])
            .filter((it) => deliveryLotId === 'all' || it.lot_id === deliveryLotId)
            .map((it) => it.delivery_lots?.name)
            .filter(Boolean)
            .join(', ');
          return [
            prById.get(d.producer_id)?.name || d.producers?.name || 'N/A',
            dtById.get(d.demand_type_id)?.name || d.demand_types?.name || 'N/A',
            lotes || '-',
            fmtInt(deliveryQty(d, deliveryLotId)),
            settlementName(d.settlement_id, d.settlements),
            fmtDate(d.completed_at),
          ];
        });
      autoTable(doc, {
        startY: y,
        head: [['Produtor', 'Tipo', 'Lote', 'Qtd', 'Assentamento', 'Finalizado']],
        body,
        styles: { fontSize: 7.5, cellPadding: 1.8 },
        headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: [244, 248, 255] },
        margin: { left: M, right: M },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Rodapé com numeração
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Secretaria de Agricultura de Confresa/MT · Página ${p} de ${pages}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 6,
        { align: 'center' },
      );
    }

    const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const tipoSlug = category === 'all' ? 'geral' : category;
    const loteSlug = lotFilterName ? '-' + slug(lotFilterName) : '';
    const assentSlug = settlementId !== 'all' ? '-' + slug(settlementName(settlementId)) : '';
    doc.save(`relatorio-atividades-${tipoSlug}${loteSlug}${assentSlug}-${format(now, 'yyyy-MM-dd')}.pdf`);
  };
  img.src = logoTransparent;
}
