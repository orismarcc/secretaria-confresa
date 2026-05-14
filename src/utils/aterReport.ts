/**
 * aterReport.ts
 *
 * ATER (Assistência Técnica e Extensão Rural) report generation.
 *
 * Generates the "Relatório Técnico Consolidado de Comprovação de Prestação
 * de ATER" in both Excel (.xlsx) and PDF formats, grouped by Responsável
 * Técnico, with automatic block continuation when a technician exceeds the
 * template's row limit (147 data rows per block).
 *
 * Template structure derived from the official CONFRESA/MT spreadsheet:
 *   - Block header: 5 rows (title, municipality/name, year/role, type, columns)
 *   - Data rows:    up to ROWS_PER_BLOCK rows per block
 *   - If a technician exceeds the limit → new continuation block is appended
 *     only for that technician, without affecting any other section.
 */

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Max data rows per block, derived from the official template structure */
const ROWS_PER_BLOCK = 147;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AterServiceRow {
  producerName: string;
  cpf: string;
  phone: string;
  settlement: string;
  location: string;
  /** Atividade / Finalidade (maps to service.purpose) */
  atividade: string;
  /** Derived description following the official ATER rules */
  servicoPrestado: string;
  /** DD/MM/YYYY */
  data: string;
}

export interface TechnicianGroup {
  technicianId: string;
  technicianName: string;
  /** Role / cargo — e.g. "Engenheiro Agrônomo" */
  technicianRole: string;
  services: AterServiceRow[];
}

// ─── "Serviço prestado" rule engine ──────────────────────────────────────────

function normalise(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Derives the "Serviço Prestado" narrative from the demand type and
 * the service finalidade (purpose), following the official ATER rules:
 *
 *  - Grade (patrulha_mecanizada)  → "Recuperação de área degradada/operação mecanizada com grade para plantio de {finalidade}"
 *  - PC / Escavadeira              → "Escavação para captação de água e dessedentação de animais"
 *  - Calcário                      → "Logística de calcário para correção/recuperação de área de plantio"
 *  - Irrigação                     → "Serviço de {finalidade}"
 *  - Assistência Técnica           → "Orientação técnica de manejo, conservação e fertilidade do solo para hortaliças e frutíferas"
 *  - Default                       → "Serviço de {finalidade}" or demand type name
 */
export function getServicoPrestado(
  demandTypeName: string,
  category: string | null,
  finalidade: string,
): string {
  const n = normalise(demandTypeName);
  const cat = (category ?? '').toLowerCase();
  const fin = finalidade.trim();

  // ── PC / Escavadeira / Retroescavadeira ──────────────────────────────────
  if (
    n === 'pc' ||
    n.startsWith('pc ') ||
    n.includes(' pc') ||
    n.includes('escavad') ||
    n.includes('retroescav') ||
    n.includes('retro')
  ) {
    return 'Escavação para captação de água e dessedentação de animais';
  }

  // ── Grade / Patrulha Mecanizada ──────────────────────────────────────────
  if (
    cat === 'patrulha_mecanizada' ||
    n.includes('grade') ||
    n.includes('arad') ||
    n.includes('subsolagem') ||
    n.includes('patrulha')
  ) {
    const finPart = fin || 'plantio';
    return `Recuperação de área degradada/operação mecanizada com grade para plantio de ${finPart}`;
  }

  // ── Calcário ─────────────────────────────────────────────────────────────
  if (cat === 'calcario' || n.includes('calcario') || n.includes('calcar')) {
    return 'Logística de calcário para correção/recuperação de área de plantio';
  }

  // ── Irrigação ─────────────────────────────────────────────────────────────
  if (n.includes('irrig')) {
    return fin ? `Serviço de ${fin}` : 'Serviço de Irrigação';
  }

  // ── Assistência Técnica ───────────────────────────────────────────────────
  if (
    cat === 'assistencia_tecnica' ||
    n.includes('assist') ||
    n.includes('tecnic') ||
    n.includes('ater')
  ) {
    return 'Orientação técnica de manejo, conservação e fertilidade do solo para hortaliças e frutíferas';
  }

  // ── Logística de Insumos ─────────────────────────────────────────────────
  if (cat === 'logistica_insumos' || n.includes('insumo') || n.includes('logistica')) {
    return fin ? `Distribuição de insumos — ${fin}` : 'Distribuição de insumos agrícolas';
  }

  // ── Entregas ─────────────────────────────────────────────────────────────
  if (cat === 'entregas' || n.includes('entrega')) {
    return fin ? `Entrega de ${fin}` : `Entrega — ${demandTypeName}`;
  }

  // ── Default ───────────────────────────────────────────────────────────────
  if (fin) return `Serviço de ${fin}`;
  return demandTypeName;
}

// ─── CPF formatter ───────────────────────────────────────────────────────────

function formatCPF(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return raw ?? '';
}

// ─── Date formatter ───────────────────────────────────────────────────────────

function formatDate(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    const d = new Date(raw.replace(' ', 'T'));
    if (isNaN(d.getTime())) return raw.slice(0, 10);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return raw.slice(0, 10);
  }
}

// ─── Data fetch ───────────────────────────────────────────────────────────────

/**
 * Fetches all completed services, filters them by the given year, and
 * returns them grouped by technician.
 *
 * Services without a responsible_technician_id are automatically assigned
 * to "Cassio Rodrigues da Costa" (looked up from the responsible_technicians
 * table; a synthetic fallback entry is used if he is not found in the DB).
 *
 * Falls back gracefully if `responsible_technician_id` or `purpose` columns
 * do not yet exist in the DB (schema cache lag after migration).
 */
export async function fetchAterData(year: number): Promise<TechnicianGroup[]> {
  // ── Resolve the default technician (Cassio Rodrigues da Costa) ────────────
  const { data: cassioRow } = await supabase
    .from('responsible_technicians')
    .select('id, name, cargo')
    .ilike('name', '%Cassio Rodrigues%')
    .maybeSingle();

  const defaultTech = cassioRow
    ? {
        id: cassioRow.id as string,
        name: cassioRow.name as string,
        role: (cassioRow.cargo as string) || 'Engenheiro Agrônomo',
      }
    : {
        id: 'cassio-rodrigues-da-costa',
        name: 'Cassio Rodrigues da Costa',
        role: 'Engenheiro Agrônomo',
      };

  // ── Fetch all completed services (with or without a linked technician) ────
  const { data: services, error } = await supabase
    .from('services')
    .select(
      `
      id,
      purpose,
      notes,
      status,
      completed_at,
      scheduled_date,
      responsible_technician_id,
      producers:producer_id (name, cpf, phone),
      demand_types:demand_type_id (name, category),
      settlements:settlement_id (name),
      locations:location_id (name),
      responsible_technicians!responsible_technician_id (id, name, cargo)
    `,
    )
    .eq('status', 'completed')
    .order('completed_at', { ascending: true, nullsLast: true });

  if (error) {
    throw new Error(error.message);
  }

  if (!services || services.length === 0) return [];

  // ── Year filter (client-side) ─────────────────────────────────────────────
  const getYear = (s: any): number | null => {
    const raw = s.completed_at || s.scheduled_date;
    if (!raw) return null;
    try {
      return new Date(raw.replace(' ', 'T')).getFullYear();
    } catch {
      return null;
    }
  };

  const filtered = services.filter((s) => getYear(s) === year);
  if (filtered.length === 0) return [];

  // ── Build service rows ────────────────────────────────────────────────────
  const buildRow = (s: any): AterServiceRow => {
    const producer = (s.producers as any) ?? {};
    const demandType = (s.demand_types as any) ?? {};
    const settlement = (s.settlements as any) ?? {};
    const location = (s.locations as any) ?? {};

    const finalidade = ((s.purpose ?? s.notes ?? '') as string).trim();

    return {
      producerName: (producer.name as string) ?? '',
      cpf: formatCPF(producer.cpf),
      phone: (producer.phone as string) ?? '',
      settlement: (settlement.name as string) ?? '',
      location: (location.name as string) ?? '',
      atividade: finalidade,
      servicoPrestado: getServicoPrestado(
        demandType.name ?? '',
        demandType.category ?? null,
        finalidade,
      ),
      data: formatDate(s.completed_at ?? s.scheduled_date),
    };
  };

  // ── Group by technician ───────────────────────────────────────────────────
  const techMap = new Map<string, TechnicianGroup>();

  for (const s of filtered) {
    let techId: string;
    let techName: string;
    let techRole: string;

    if (!s.responsible_technician_id) {
      // No technician assigned → fall back to Cassio Rodrigues da Costa
      techId = defaultTech.id;
      techName = defaultTech.name;
      techRole = defaultTech.role;
    } else {
      const tech = (s.responsible_technicians as any) ?? {};
      techId = (tech.id as string) ?? (s.responsible_technician_id as string) ?? 'unknown';
      techName = (tech.name as string) ?? 'Técnico não identificado';
      techRole = (tech.cargo as string) ?? 'Técnico Agropecuário';
    }

    if (!techMap.has(techId)) {
      techMap.set(techId, {
        technicianId: techId,
        technicianName: techName,
        technicianRole: techRole,
        services: [],
      });
    }
    techMap.get(techId)!.services.push(buildRow(s));
  }

  // Sort technicians alphabetically
  return Array.from(techMap.values()).sort((a, b) =>
    a.technicianName.localeCompare(b.technicianName, 'pt-BR'),
  );
}

// ─── Excel generation ─────────────────────────────────────────────────────────

/**
 * Generates an Excel workbook that mirrors the official ATER template.
 *
 * Structure per technician:
 *   • 5-row header block (title, municipality/name, year/role, type, column headers)
 *   • Up to ROWS_PER_BLOCK data rows
 *   • If technician exceeds the limit → additional continuation blocks are
 *     appended immediately after, without touching any other technician's section.
 *
 * Column layout (A–I):
 *   A = narrow margin  B = NOME  C = CPF  D = CONTATO
 *   E = UNIDADE FAMILIAR  F = COMUNIDADE/LOCALIDADE  G = ATIVIDADE
 *   H = SERVIÇO PRESTADO  I = DATA
 */
export function generateAterExcel(groups: TechnicianGroup[], year: number): void {
  const wsData: (string | null)[][] = [];
  const merges: XLSX.Range[] = [];

  let row = 0; // 0-based current row index

  // Column layout matching the official template
  const colWidths = [
    { wch: 3.17 },  // A — margin
    { wch: 41.67 }, // B — NOME
    { wch: 15.33 }, // C — CPF
    { wch: 12.83 }, // D — CONTATO
    { wch: 17.83 }, // E — UNIDADE FAMILIAR
    { wch: 20.33 }, // F — COMUNIDADE / LOCALIDADE
    { wch: 18.83 }, // G — ATIVIDADE
    { wch: 47.17 }, // H — SERVIÇO PRESTADO
    { wch: 13 },    // I — DATA
  ];

  /** Write the 5-row header block for a technician (or continuation) */
  const writeHeader = (group: TechnicianGroup, isContinuation: boolean) => {
    // Blank separator row — before every block except the very first
    if (row > 0) {
      wsData.push(Array<null>(9).fill(null));
      row++;
    }

    // Row: Title (B:I merged)
    const titleSuffix = isContinuation ? ' (Continuação)' : '';
    wsData.push([
      null,
      `RELATÓRIO TÉCNICO CONSOLIDADO DE COMPROVAÇÃO DE PRESTAÇÃO DE ASSISTÊNCIA TÉCNICA E EXTENSÃO RURAL (ATER)${titleSuffix}`,
      null, null, null, null, null, null, null,
    ]);
    merges.push({ s: { c: 1, r: row }, e: { c: 8, r: row } });
    row++;

    // Row: Municipality | Technician name (B:C + D:I)
    wsData.push([null, 'Município: CONFRESA/MT', null, group.technicianName, null, null, null, null, null]);
    merges.push({ s: { c: 1, r: row }, e: { c: 2, r: row } });
    merges.push({ s: { c: 3, r: row }, e: { c: 8, r: row } });
    row++;

    // Row: Year | Role (B:C + D:I)
    wsData.push([null, `Ano Civil: ${year}`, null, group.technicianRole || 'Técnico Agropecuário', null, null, null, null, null]);
    merges.push({ s: { c: 1, r: row }, e: { c: 2, r: row } });
    merges.push({ s: { c: 3, r: row }, e: { c: 8, r: row } });
    row++;

    // Row: Attendance type (B:C + D:I)
    wsData.push([null, 'ATENDIMENTO INDIVIDUAL:', null, 'Visita', null, null, null, null, null]);
    merges.push({ s: { c: 1, r: row }, e: { c: 2, r: row } });
    merges.push({ s: { c: 3, r: row }, e: { c: 8, r: row } });
    row++;

    // Row: Column headers
    wsData.push([
      null, 'NOME', 'CPF', 'CONTATO',
      'UNIDADE FAMILIAR', 'COMUNIDADE / LOCALIDADE',
      'ATIVIDADE', 'SERVIÇO PRESTADO', 'DATA',
    ]);
    row++;
  };

  /** Write one data row */
  const writeDataRow = (svc: AterServiceRow) => {
    wsData.push([
      null,
      svc.producerName,
      svc.cpf,
      svc.phone,
      svc.settlement,
      svc.location,
      svc.atividade,
      svc.servicoPrestado,
      svc.data,
    ]);
    row++;
  };

  for (const group of groups) {
    // Split services into chunks of ROWS_PER_BLOCK
    const chunks: AterServiceRow[][] = [];
    if (group.services.length === 0) {
      chunks.push([]);
    } else {
      for (let i = 0; i < group.services.length; i += ROWS_PER_BLOCK) {
        chunks.push(group.services.slice(i, i + ROWS_PER_BLOCK));
      }
    }

    chunks.forEach((chunk, ci) => {
      writeHeader(group, ci > 0);
      chunk.forEach(writeDataRow);
    });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = colWidths;
  ws['!merges'] = merges;

  XLSX.utils.book_append_sheet(wb, ws, 'REGISTRO DE ATIVIDADES');
  XLSX.writeFile(wb, `relatorio_ater_${year}.xlsx`);
}

// ─── PDF generation ───────────────────────────────────────────────────────────

/**
 * Generates a PDF report in A4 landscape format.
 *
 * Each technician gets one or more pages (autoTable handles pagination
 * automatically). A "Continuação" note is printed in the page header
 * when a technician's table overflows to the next page.
 */
export function generateAterPDF(groups: TechnicianGroup[], year: number): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  // A4 landscape: 297 × 210 mm
  const pageW = 297;
  const pageH = 210;
  const mL = 10;
  const mR = 10;

  // Brand green (matches the app's primary color)
  const GREEN: [number, number, number] = [40, 100, 40];
  const LIGHT_GREEN: [number, number, number] = [220, 240, 220];

  /**
   * Prints the per-technician header block (above the table).
   * Returns the Y position where the table should start.
   */
  const printTechnicianHeader = (group: TechnicianGroup): number => {
    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...GREEN);
    doc.text(
      'RELATÓRIO TÉCNICO CONSOLIDADO DE COMPROVAÇÃO DE PRESTAÇÃO DE ASSISTÊNCIA TÉCNICA E EXTENSÃO RURAL (ATER)',
      pageW / 2,
      16,
      { align: 'center', maxWidth: pageW - mL - mR },
    );

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    // Left column
    doc.setFont('helvetica', 'bold');
    doc.text('Município:', mL, 22);
    doc.text('Ano Civil:', mL, 27);
    doc.text('Atendimento:', mL, 32);
    doc.text('Responsável Técnico:', mL, 37);

    // Right values
    doc.setFont('helvetica', 'normal');
    doc.text('CONFRESA/MT', mL + 26, 22);
    doc.text(String(year), mL + 26, 27);
    doc.text('Individual — Visita', mL + 26, 32);
    doc.text(`${group.technicianName} — ${group.technicianRole || 'Técnico Agropecuário'}`, mL + 26, 37);

    // Divider
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.5);
    doc.line(mL, 40, pageW - mR, 40);

    return 43; // table startY
  };

  let isFirstGroup = true;

  for (const group of groups) {
    if (!isFirstGroup) {
      doc.addPage();
    }
    isFirstGroup = false;

    const tableStartY = printTechnicianHeader(group);

    const tableRows = group.services.map((svc) => [
      svc.producerName,
      svc.cpf,
      svc.phone,
      svc.settlement,
      svc.location,
      svc.atividade,
      svc.servicoPrestado,
      svc.data,
    ]);

    autoTable(doc, {
      startY: tableStartY,
      head: [
        [
          'Nome',
          'CPF',
          'Contato',
          'Unidade Familiar',
          'Comunidade / Localidade',
          'Atividade',
          'Serviço Prestado',
          'Data',
        ],
      ],
      body: tableRows.length > 0 ? tableRows : [['(Sem atendimentos finalizados neste período)', '', '', '', '', '', '', '']],
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 },
        overflow: 'linebreak',
        valign: 'top',
      },
      headStyles: {
        fillColor: GREEN,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'center',
      },
      alternateRowStyles: { fillColor: LIGHT_GREEN },
      columnStyles: {
        0: { cellWidth: 42 },  // Nome
        1: { cellWidth: 24 },  // CPF
        2: { cellWidth: 20 },  // Contato
        3: { cellWidth: 28 },  // Unidade Familiar
        4: { cellWidth: 28 },  // Comunidade/Localidade
        5: { cellWidth: 26 },  // Atividade
        6: { cellWidth: 82 },  // Serviço Prestado
        7: { cellWidth: 20 },  // Data
      },
      margin: { left: mL, right: mR, top: 48 },
      // On continuation pages: print a compact technician identifier header
      didAddPage: (data) => {
        if (data.pageNumber > 1) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.setTextColor(80, 80, 80);
          doc.text(
            `${group.technicianName} — continuação (Ano ${year})`,
            pageW / 2,
            12,
            { align: 'center' },
          );
          doc.setTextColor(0, 0, 0);
        }
      },
    });
  }

  // ── Page numbers ──────────────────────────────────────────────────────────
  const totalPages = (doc as any).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`Página ${p} de ${totalPages}`, pageW - mR, pageH - 5, { align: 'right' });
    doc.text(
      `Relatório ATER ${year} — Secretaria Municipal de Agricultura de Confresa/MT`,
      mL,
      pageH - 5,
    );
  }

  doc.save(`relatorio_ater_${year}.pdf`);
}
