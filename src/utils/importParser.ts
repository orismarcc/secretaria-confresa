/**
 * importParser.ts
 *
 * Header-based Excel parser + validation layer for the Atendimentos import.
 *
 * Design decisions:
 *  - Detects the header row by scanning for a cell whose normalised value is "produtor".
 *  - Builds a column-index map from the header row (case + accent insensitive).
 *  - Parses every non-empty data row into a ParsedRow with errors and warnings.
 *  - Errors   → row is NOT imported (blocking).
 *  - Warnings → row IS imported, but user is notified.
 *  - In-file duplicates (same producer + demand type + scheduled date) are flagged and skipped.
 *  - downloadErrorReport() generates a per-row Excel validation report.
 */

import * as XLSX from 'xlsx';
import { COLUMN_DEFS } from './importTemplate';

// ─── Normalisation helpers ──────────────────────────────────────────────────

/** Lowercase + strip diacritics + collapse whitespace */
export function norm(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normCPF(val: unknown): string {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return digits;
}

export function normPhone(val: unknown): string {
  if (!val) return '';
  return String(val).replace(/\D/g, '').slice(0, 15);
}

// ─── Date parsing ───────────────────────────────────────────────────────────

/**
 * Accepts a Date object (from cellDates:true), a numeric Excel serial,
 * a DD/MM/YYYY string, a YYYY-MM-DD string, or null/undefined.
 */
export function parseExcelDate(val: unknown): Date | null {
  if (val === null || val === undefined || val === '') return null;

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  if (typeof val === 'number') {
    // Excel serial dates are > 1 (1 = 1900-01-01). Values below 100 are likely years
    // or corrupt data — skip them.
    if (val > 100) {
      const epoch = Math.round((val - 25569) * 86400 * 1000);
      const d = new Date(epoch);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  if (typeof val === 'string') {
    const s = val.trim();

    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
      return isNaN(d.getTime()) ? null : d;
    }

    // YYYY-MM-DD
    const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
      const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
      return isNaN(d.getTime()) ? null : d;
    }
  }

  return null;
}

// ─── Enum maps ──────────────────────────────────────────────────────────────

export type ServiceStatus = 'pending' | 'in_progress' | 'completed' | 'proximo';
export type ServicePriority = 'low' | 'medium' | 'high';

export const STATUS_MAP: Record<string, ServiceStatus> = {
  pendente: 'pending',
  'em execucao': 'in_progress',
  finalizado: 'completed',
  realizado: 'completed',
  realizada: 'completed',
  proximo: 'proximo',
};

export const PRIORITY_MAP: Record<string, ServicePriority> = {
  baixa: 'low',
  media: 'medium',
  alta: 'high',
};

function parseBoolean(val: unknown): boolean | null {
  if (val === null || val === undefined || String(val).trim() === '') return null;
  const n = norm(String(val));
  if (n === 'sim' || n === 's' || n === '1' || n === 'true') return true;
  if (n === 'nao' || n === 'n' || n === '0' || n === 'false') return false;
  return null;
}

function parseNumber(val: unknown): number | null {
  if (val === null || val === undefined || String(val).trim() === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const n = parseFloat(String(val).replace(',', '.'));
  return isNaN(n) ? null : n;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NamedRecord {
  id: string;
  name: string;
}

export type MatchQuality = 'exact' | 'fuzzy' | 'none';

export interface ParsedRow {
  /** 1-based row number in the original file */
  rowNum: number;

  // Raw values (as extracted from Excel)
  producerName: string;
  cpf: string;
  phone: string;
  settlementName: string;
  locationName: string;
  demandTypeName: string;
  statusLabel: string;
  priorityLabel: string;
  scheduledDateRaw: string;
  registeredDateRaw: string;
  completedDateRaw: string;
  machineryName: string;
  operatorName: string;
  technicianName: string;
  damIssuedRaw: string;
  damPaidRaw: string;
  notes: string;

  // Parsed / typed values
  scheduledDate: Date | null;
  registeredDate: Date | null;
  completedDate: Date | null;
  workedArea: number | null;
  limestoneQuantity: number | null;
  inputQuantity: number | null;
  damIssued: boolean | null;
  damPaid: boolean | null;

  // Resolved DB IDs
  status: ServiceStatus | null;
  priority: ServicePriority | null;
  demandTypeId: string | null;
  demandTypeMatch: boolean;
  settlementId: string | null;
  settlementMatch: MatchQuality;
  machineryId: string | null;
  machineryMatch: MatchQuality;
  operatorId: string | null;
  operatorMatch: MatchQuality;
  technicianId: string | null;
  technicianMatch: MatchQuality;

  // Validation
  errors: string[];   // blocking — row will NOT be imported
  warnings: string[]; // non-blocking — row is imported with a note
  isDuplicate: boolean;
  willImport: boolean;
}

export interface ParseContext {
  demandTypes: NamedRecord[];
  settlements: NamedRecord[];
  machinery: NamedRecord[];
  operators: NamedRecord[];
  technicians: NamedRecord[];
}

export interface ParseResult {
  rows: ParsedRow[];
  /** Total non-empty rows encountered (including skipped/error ones) */
  totalDataRows: number;
  /** 0-based index of the header row in the original sheet */
  headerRowIndex: number;
  sheetName: string;
}

// ─── Fuzzy record matching ──────────────────────────────────────────────────

export function bestMatch<T extends NamedRecord>(
  raw: string,
  list: T[],
): { item: T | null; quality: MatchQuality } {
  const n = norm(raw);
  if (!n) return { item: null, quality: 'none' };

  const exact = list.find((x) => norm(x.name) === n);
  if (exact) return { item: exact, quality: 'exact' };

  const fuzzy = list.find(
    (x) => norm(x.name).includes(n) || n.includes(norm(x.name)),
  );
  if (fuzzy) return { item: fuzzy, quality: 'fuzzy' };

  return { item: null, quality: 'none' };
}

// ─── Main parser ────────────────────────────────────────────────────────────

export function parseImportFile(buffer: ArrayBuffer, ctx: ParseContext): ParseResult {
  // Read with cellDates:true so date cells come back as Date objects
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  // Prefer a sheet named "Atendimentos"; otherwise use the first sheet
  const sheetName = wb.SheetNames.includes('Atendimentos')
    ? 'Atendimentos'
    : wb.SheetNames[0];

  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error('Nenhuma aba de dados encontrada no arquivo.');

  // raw:true preserves native types (Date, number, string)
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  });

  // ── Locate header row ──────────────────────────────────────────
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(raw.length, 12); i++) {
    const row = raw[i];
    if (!row) continue;
    const hasProdutor = row.some(
      (cell) => norm(String(cell ?? '')) === 'produtor',
    );
    if (hasProdutor) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error(
      'Cabeçalho não encontrado. O arquivo deve ter a coluna "Produtor" — use o modelo correto.',
    );
  }

  // ── Build column-index map (case + accent insensitive) ─────────
  const headerRow = raw[headerRowIndex] ?? [];
  const colMap: Record<string, number> = {};

  for (let c = 0; c < headerRow.length; c++) {
    const cellNorm = norm(String(headerRow[c] ?? ''));
    for (const def of COLUMN_DEFS) {
      if (norm(def.header) === cellNorm) {
        colMap[def.field] = c;
      }
    }
  }

  // Helper: get string value from a parsed row by field name
  const getString = (row: unknown[], field: string): string => {
    const idx = colMap[field];
    if (idx === undefined) return '';
    return String(row[idx] ?? '').trim();
  };

  // Helper: get raw cell value by field name (for type-aware parsing)
  const getRaw = (row: unknown[], field: string): unknown => {
    const idx = colMap[field];
    return idx !== undefined ? row[idx] : null;
  };

  // ── Parse data rows ────────────────────────────────────────────
  const rows: ParsedRow[] = [];
  let totalDataRows = 0;

  // In-file duplicate detection: producerKey|demandTypeNorm|scheduledDateISO
  const seen = new Set<string>();

  for (let i = headerRowIndex + 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r) continue;

    // Skip entirely empty rows
    const isEmpty = r.every(
      (cell) => cell === null || cell === undefined || String(cell).trim() === '',
    );
    if (isEmpty) continue;

    totalDataRows++;

    // ── Extract raw string values ────────────────────────────────
    const producerName = getString(r, 'producerName');
    const cpf = normCPF(getRaw(r, 'cpf'));
    const phone = normPhone(getRaw(r, 'phone'));
    const settlementName = getString(r, 'settlementName');
    const locationName = getString(r, 'locationName');
    const demandTypeName = getString(r, 'demandTypeName');
    const statusLabel = getString(r, 'statusLabel');
    const priorityLabel = getString(r, 'priorityLabel');
    const scheduledDateRaw = getString(r, 'scheduledDate');
    const registeredDateRaw = getString(r, 'registeredDate');
    const completedDateRaw = getString(r, 'completedDate');
    const machineryName = getString(r, 'machineryName');
    const operatorName = getString(r, 'operatorName');
    const technicianName = getString(r, 'technicianName');
    const damIssuedRaw = getString(r, 'damIssued');
    const damPaidRaw = getString(r, 'damPaid');
    const notes = getString(r, 'notes');

    // Skip example row (producer name starts with "EXEMPLO:")
    if (norm(producerName).startsWith('exemplo')) {
      continue;
    }

    // ── Parse typed values ───────────────────────────────────────
    const scheduledDate = parseExcelDate(getRaw(r, 'scheduledDate') ?? scheduledDateRaw);
    const registeredDate = parseExcelDate(getRaw(r, 'registeredDate') ?? registeredDateRaw);
    const completedDate = parseExcelDate(getRaw(r, 'completedDate') ?? completedDateRaw);
    const workedArea = parseNumber(getRaw(r, 'workedArea'));
    const limestoneQuantity = parseNumber(getRaw(r, 'limestoneQuantity'));
    const inputQuantity = parseNumber(getRaw(r, 'inputQuantity'));
    const damIssued = parseBoolean(getRaw(r, 'damIssued') ?? damIssuedRaw);
    const damPaid = parseBoolean(getRaw(r, 'damPaid') ?? damPaidRaw);

    // ── Resolve enums ────────────────────────────────────────────
    const status = STATUS_MAP[norm(statusLabel)] ?? null;
    const priority = PRIORITY_MAP[norm(priorityLabel)] ?? null;

    // ── Resolve DB records ───────────────────────────────────────
    const dtResult = bestMatch(demandTypeName, ctx.demandTypes);
    const demandTypeId = dtResult.item?.id ?? null;
    const demandTypeMatch = dtResult.quality !== 'none';

    const smResult = bestMatch(settlementName, ctx.settlements);
    const settlementId = smResult.item?.id ?? null;
    const settlementMatch = smResult.quality;

    const mmResult = bestMatch(machineryName, ctx.machinery);
    const machineryId = mmResult.item?.id ?? null;
    const machineryMatch = mmResult.quality;

    const omResult = bestMatch(operatorName, ctx.operators);
    const operatorId = omResult.item?.id ?? null;
    const operatorMatch = omResult.quality;

    const tmResult = bestMatch(technicianName, ctx.technicians);
    const technicianId = tmResult.item?.id ?? null;
    const technicianMatch = tmResult.quality;

    // ── Validation ───────────────────────────────────────────────
    const errors: string[] = [];
    const warnings: string[] = [];

    // --- Errors (blocking) ---
    if (!producerName) {
      errors.push('Produtor é obrigatório');
    }
    if (!demandTypeName) {
      errors.push('Tipo de Serviço é obrigatório');
    } else if (!demandTypeMatch) {
      errors.push(`Tipo de Serviço "${demandTypeName}" não encontrado no sistema`);
    }
    if (!statusLabel) {
      errors.push('Status é obrigatório');
    } else if (!status) {
      errors.push(
        `Status "${statusLabel}" inválido — use: Pendente, Em Execução, Finalizado ou Próximo`,
      );
    }
    if (!scheduledDate) {
      if (scheduledDateRaw) {
        errors.push(
          `Data Agendamento "${scheduledDateRaw}" inválida — use formato DD/MM/AAAA`,
        );
      } else {
        errors.push('Data Agendamento é obrigatória');
      }
    }

    // --- Warnings (non-blocking) ---
    if (settlementName && settlementMatch === 'none') {
      warnings.push(
        `Assentamento "${settlementName}" não encontrado — atendimento importado sem assentamento`,
      );
    }
    if (machineryName && machineryMatch === 'none') {
      warnings.push(`Maquinário "${machineryName}" não encontrado no cadastro`);
    }
    if (operatorName && operatorMatch === 'none') {
      warnings.push(`Operador "${operatorName}" não encontrado no cadastro`);
    }
    if (technicianName && technicianMatch === 'none') {
      warnings.push(`Resp. Técnico "${technicianName}" não encontrado no cadastro`);
    }
    if (status === 'completed' && !completedDate) {
      warnings.push(
        'Data Finalização não informada para atendimento com Status = Finalizado',
      );
    }

    // ── In-file duplicate detection ──────────────────────────────
    const producerKey = cpf || norm(producerName);
    const dateKey = scheduledDate?.toISOString().slice(0, 10) ?? scheduledDateRaw;
    const dupKey = `${producerKey}|${norm(demandTypeName)}|${dateKey}`;
    const isDuplicate = seen.has(dupKey);

    if (!isDuplicate && producerKey && norm(demandTypeName) && scheduledDate) {
      seen.add(dupKey);
    }

    if (isDuplicate) {
      warnings.push(
        'Linha duplicada (mesmo produtor + tipo de serviço + data) — será ignorada',
      );
    }

    const willImport = errors.length === 0 && !isDuplicate;

    rows.push({
      rowNum: i + 1,
      producerName,
      cpf,
      phone,
      settlementName,
      locationName,
      demandTypeName,
      statusLabel,
      priorityLabel,
      scheduledDateRaw,
      registeredDateRaw,
      completedDateRaw,
      machineryName,
      operatorName,
      technicianName,
      damIssuedRaw,
      damPaidRaw,
      notes,
      scheduledDate,
      registeredDate,
      completedDate,
      workedArea,
      limestoneQuantity,
      inputQuantity,
      damIssued,
      damPaid,
      status,
      priority,
      demandTypeId,
      demandTypeMatch,
      settlementId,
      settlementMatch,
      machineryId,
      machineryMatch,
      operatorId,
      operatorMatch,
      technicianId,
      technicianMatch,
      errors,
      warnings,
      isDuplicate,
      willImport,
    });
  }

  return { rows, totalDataRows, headerRowIndex, sheetName };
}

// ─── Error report download ──────────────────────────────────────────────────

export function downloadValidationReport(rows: ParsedRow[]): void {
  const now = new Date();
  const stamp = now.toLocaleString('pt-BR');

  const data: unknown[][] = [
    [`RELATÓRIO DE VALIDAÇÃO — Importação de Atendimentos`],
    [`Gerado em: ${stamp}  |  Total de linhas: ${rows.length}`],
    [],
    [
      'Linha',
      'Produtor',
      'Tipo de Serviço',
      'Status',
      'Data Agendamento',
      'Situação',
      'Erros / Avisos',
    ],
  ];

  for (const row of rows) {
    const situation = row.isDuplicate
      ? 'DUPLICADO — ignorado'
      : row.errors.length > 0
        ? 'ERRO — não importado'
        : row.warnings.length > 0
          ? 'AVISO — importado com ressalvas'
          : 'OK — importado';

    const messages = [...row.errors.map((e) => `[ERRO] ${e}`), ...row.warnings.map((w) => `[AVISO] ${w}`)].join(
      '\n',
    );

    data.push([
      row.rowNum,
      row.producerName,
      row.demandTypeName,
      row.statusLabel,
      row.scheduledDateRaw || (row.scheduledDate?.toLocaleDateString('pt-BR') ?? ''),
      situation,
      messages,
    ]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);

  ws['!cols'] = [
    { wch: 7 },
    { wch: 30 },
    { wch: 26 },
    { wch: 16 },
    { wch: 18 },
    { wch: 32 },
    { wch: 70 },
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Validação');
  XLSX.writeFile(wb, `validacao_importacao_${now.toISOString().slice(0, 10)}.xlsx`);
}
