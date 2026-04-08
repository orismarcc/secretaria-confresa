import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  useDemandTypes,
  useSettlements,
  useMachinery,
} from '@/hooks/useSupabaseData';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ParsedRow {
  sheet: 'grade' | 'pc';
  rowNum: number;
  // raw from Excel
  cadastroDate: Date | null;
  serviceDate: Date | null;
  statusRaw: string;
  producerName: string;
  cpf: string;
  phone: string;
  settlementName: string;
  locationName: string;
  purpose: string;
  workedArea: number | null;
  tractorName: string;
  operatorName: string;
  // resolved
  status: 'pending' | 'in_progress' | 'completed';
  demandTypeId: string;
  settlementId: string | null;
  settlementMatch: 'exact' | 'none';
  machineryId: string | null;
  machineryMatch: 'exact' | 'fuzzy' | 'none';
  operatorId: string | null;
  operatorMatch: 'exact' | 'fuzzy' | 'none';
  skip: boolean;
  skipReason?: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function norm(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normCPF(val: unknown): string {
  if (!val) return '';
  const s = String(val).replace(/\D/g, '');
  if (s.length === 11) return `${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6,9)}-${s.slice(9)}`;
  return s;
}

function normPhone(val: unknown): string {
  if (!val) return '';
  return String(val).replace(/\D/g, '').slice(0, 15);
}

function excelDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    // Excel serial date
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function mapStatus(raw: string, sheet: 'grade' | 'pc'): 'pending' | 'in_progress' | 'completed' {
  const n = norm(raw);
  if (sheet === 'grade') {
    if (n === 'realizada') return 'completed';
    if (n === 'em execucao') return 'in_progress';
  } else {
    if (n === 'realizado') return 'completed';
    if (n === 'em execucao') return 'in_progress';
  }
  return 'pending';
}

function bestMatch<T extends { id: string; name: string }>(
  raw: string,
  list: T[]
): { item: T | null; quality: 'exact' | 'fuzzy' | 'none' } {
  const n = norm(raw);
  if (!n) return { item: null, quality: 'none' };
  // exact
  const exact = list.find(x => norm(x.name) === n);
  if (exact) return { item: exact, quality: 'exact' };
  // contains (both directions)
  const fuzzy = list.find(
    x => norm(x.name).includes(n) || n.includes(norm(x.name))
  );
  if (fuzzy) return { item: fuzzy, quality: 'fuzzy' };
  return { item: null, quality: 'none' };
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function ImportServicesPage() {
  const { toast } = useToast();
  const { data: demandTypes = [] } = useDemandTypes();
  const { data: settlements = [] } = useSettlements();
  const { data: machineryList = [] } = useMachinery();

  const [isDragging, setIsDragging] = useState(false);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Demand type IDs
  const gradeId = (demandTypes as any[]).find(d => norm(d.name) === 'grade')?.id ?? null;
  const pcId = (demandTypes as any[]).find(d => norm(d.name) === 'pc')?.id ?? null;

  // Fetch operators once
  const [operators, setOperators] = useState<{ id: string; name: string }[]>([]);
  useState(() => {
    supabase
      .from('user_roles')
      .select('user_id, profiles!user_id(id, name)')
      .eq('role', 'operator')
      .then(({ data }) => {
        if (data) setOperators(data.map((r: any) => r.profiles).filter(Boolean));
      });
  });

  // ── Parse Excel file ──────────────────────────────────────────────────────
  const parseFile = useCallback(
    async (file: File) => {
      if (!gradeId || !pcId) {
        toast({ title: 'Aguarde carregar os tipos de demanda.', variant: 'destructive' });
        return;
      }

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });

      const TARGET_SHEETS: Record<string, 'grade' | 'pc'> = {
        'Controle de operação com grade': 'grade',
        'Controle de operação com PC': 'pc',
      };

      const parsed: ParsedRow[] = [];

      for (const [sheetName, sheetType] of Object.entries(TARGET_SHEETS)) {
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;

        const raw: any[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: null,
          raw: false,
          dateNF: 'yyyy-mm-dd',
        });

        // Grade: header row 3 (index 2), data from row 4 (index 3)
        // PC:    header row 2 (index 1), data from row 3 (index 2)
        const dataStart = sheetType === 'grade' ? 3 : 2;

        for (let i = dataStart; i < raw.length; i++) {
          const r = raw[i];
          if (!r) continue;

          // Col indices (0-based): B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9, K=10, L=11, M=12
          const statusRaw = String(r[3] ?? '').trim();

          // Skip non-data rows
          if (!statusRaw || norm(statusRaw) === 'dias uteis sem atendimento') continue;
          const producerName = String(r[4] ?? '').trim();
          if (!producerName) continue;

          let tractorName = '', operatorName = '';
          if (sheetType === 'grade') {
            tractorName = String(r[11] ?? '').trim();
            operatorName = String(r[12] ?? '').trim();
          } else {
            tractorName = String(r[10] ?? '').trim();
            operatorName = String(r[11] ?? '').trim();
            // If operator looks like machinery name, clear it
            if (norm(operatorName) === norm(tractorName)) operatorName = '';
          }

          const settlementName = String(r[7] ?? '').trim();
          const locationName = String(r[8] ?? '').trim();

          // Resolve settlement
          const smatch = bestMatch(settlementName, settlements as any[]);
          // Resolve machinery
          const mmatch = bestMatch(tractorName, machineryList as any[]);
          // Resolve operator
          const omatch = bestMatch(operatorName, operators);

          const status = mapStatus(statusRaw, sheetType);
          const demandTypeId = sheetType === 'grade' ? gradeId : pcId;

          // Parse dates
          const cadastroDate = excelDate(r[1]);
          const serviceDate = sheetType === 'grade' ? excelDate(r[2]) : excelDate(r[1]);

          parsed.push({
            sheet: sheetType,
            rowNum: i + 1,
            cadastroDate,
            serviceDate,
            statusRaw,
            producerName,
            cpf: normCPF(r[5]),
            phone: normPhone(r[6]),
            settlementName,
            locationName,
            purpose: String(r[9] ?? '').trim(),
            workedArea: r[10] != null && sheetType === 'grade' ? parseFloat(String(r[10])) || null : null,
            tractorName,
            operatorName,
            status,
            demandTypeId,
            settlementId: smatch.item?.id ?? null,
            settlementMatch: smatch.quality === 'none' ? 'none' : 'exact',
            machineryId: mmatch.item?.id ?? null,
            machineryMatch: mmatch.quality,
            operatorId: omatch.item?.id ?? null,
            operatorMatch: omatch.quality,
            skip: false,
          });
        }
      }

      setRows(parsed);
      setResult(null);
    },
    [demandTypes, settlements, machineryList, operators, gradeId, pcId, toast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file?.name.endsWith('.xlsx')) parseFile(file);
      else toast({ title: 'Selecione um arquivo .xlsx', variant: 'destructive' });
    },
    [parseFile, toast]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = '';
  };

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!rows) return;
    setImporting(true);

    const { data: { user } } = await supabase.auth.getUser();
    const importedBy = user?.id ?? null;

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // 1. Collect unique producers (CPF as key, or name if no CPF)
    const producerMap = new Map<string, string>(); // key → producer_id

    const uniqueProducers = new Map<string, { name: string; cpf: string; phone: string }>();
    for (const row of rows) {
      if (row.skip) continue;
      const key = row.cpf || norm(row.producerName);
      if (!uniqueProducers.has(key)) {
        uniqueProducers.set(key, { name: row.producerName, cpf: row.cpf, phone: row.phone });
      }
    }

    // Upsert producers
    for (const [key, p] of uniqueProducers) {
      try {
        // Check by CPF first
        let existingId: string | null = null;
        if (p.cpf) {
          const { data } = await supabase.from('producers').select('id').eq('cpf', p.cpf).maybeSingle();
          existingId = data?.id ?? null;
        }
        if (!existingId) {
          const { data } = await supabase.from('producers')
            .select('id').ilike('name', p.name).maybeSingle();
          existingId = data?.id ?? null;
        }
        if (existingId) {
          producerMap.set(key, existingId);
        } else {
          const insertData: any = { name: p.name };
          if (p.cpf) insertData.cpf = p.cpf;
          if (p.phone) insertData.phone = p.phone;
          const { data, error } = await supabase.from('producers').insert(insertData).select('id').single();
          if (error) throw error;
          producerMap.set(key, data.id);
        }
      } catch (err: any) {
        errors.push(`Produtor "${p.name}": ${err.message}`);
      }
    }

    // 2. Collect unique locations per settlement
    const locationMap = new Map<string, string>(); // "settlId|locName" → location_id

    const uniqueLocations = new Set<string>();
    for (const row of rows) {
      if (row.skip || !row.settlementId || !row.locationName) continue;
      uniqueLocations.add(`${row.settlementId}|${row.locationName}`);
    }

    for (const key of uniqueLocations) {
      const [settlId, locName] = key.split('|');
      try {
        const { data: existing } = await supabase.from('locations')
          .select('id').eq('settlement_id', settlId).ilike('name', locName).maybeSingle();
        if (existing) {
          locationMap.set(key, existing.id);
        } else {
          const { data, error } = await supabase.from('locations')
            .insert({ name: locName, settlement_id: settlId }).select('id').single();
          if (error) throw error;
          locationMap.set(key, data.id);
        }
      } catch (err: any) {
        // Non-fatal — just skip location_id
      }
    }

    // 3. Insert services
    for (const row of rows) {
      if (row.skip) { skipped++; continue; }

      const producerKey = row.cpf || norm(row.producerName);
      const producerId = producerMap.get(producerKey);
      if (!producerId) { skipped++; continue; }

      const locationKey = row.settlementId && row.locationName
        ? `${row.settlementId}|${row.locationName}` : null;
      const locationId = locationKey ? locationMap.get(locationKey) ?? null : null;

      const scheduledDate = row.serviceDate ?? row.cadastroDate ?? new Date();

      const serviceData: any = {
        producer_id: producerId,
        demand_type_id: row.demandTypeId,
        settlement_id: row.settlementId ?? undefined,
        location_id: locationId ?? undefined,
        scheduled_date: scheduledDate.toISOString().slice(0, 10),
        notes: row.purpose || undefined,
        status: row.status,
        worked_area: row.workedArea ?? undefined,
        machinery_id: row.machineryId ?? undefined,
        operator_id: row.operatorId ?? undefined,
        created_by: importedBy,
      };

      if (row.cadastroDate) {
        serviceData.created_at = row.cadastroDate.toISOString();
      }
      if (row.status === 'completed' && row.serviceDate) {
        serviceData.completed_at = row.serviceDate.toISOString();
      }

      try {
        const { error } = await supabase.from('services').insert(serviceData);
        if (error) throw error;
        imported++;
      } catch (err: any) {
        errors.push(`Linha ${row.rowNum} (${row.producerName}): ${err.message}`);
        skipped++;
      }
    }

    setResult({ imported, skipped, errors });
    setImporting(false);
    if (imported > 0) {
      toast({ title: `${imported} atendimentos importados com sucesso!` });
    }
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = rows
    ? {
        total: rows.length,
        grade: rows.filter(r => r.sheet === 'grade').length,
        pc: rows.filter(r => r.sheet === 'pc').length,
        unmatched: {
          settlement: rows.filter(r => r.settlementMatch === 'none' && r.settlementName).length,
          machinery: rows.filter(r => r.machineryMatch === 'none' && r.tractorName).length,
          operator: rows.filter(r => r.operatorMatch === 'none' && r.operatorName).length,
        },
        byStatus: {
          completed: rows.filter(r => r.status === 'completed').length,
          in_progress: rows.filter(r => r.status === 'in_progress').length,
          pending: rows.filter(r => r.status === 'pending').length,
        },
      }
    : null;

  const previewRows = rows ? (showAll ? rows : rows.slice(0, 10)) : [];

  return (
    <AppLayout>
      <PageHeader
        title="Importar Planilha"
        description="Importe atendimentos do Excel — abas Controle de Grade e PC"
      />

      {/* Upload Zone */}
      {!rows && (
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
          }`}
          onClick={() => document.getElementById('xlsx-input')?.click()}
        >
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-semibold mb-1">Arraste o arquivo .xlsx aqui</p>
          <p className="text-sm text-muted-foreground mb-4">ou clique para selecionar</p>
          <Button variant="outline" type="button">
            <Upload className="h-4 w-4 mr-2" />
            Selecionar arquivo
          </Button>
          <input id="xlsx-input" type="file" accept=".xlsx" className="hidden" onChange={handleFileInput} />
        </div>
      )}

      {/* Stats after parse */}
      {stats && !result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-4 text-center"><p className="text-3xl font-black">{stats.total}</p><p className="text-xs text-muted-foreground mt-1">Total de linhas</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-3xl font-black text-amber-600">{stats.grade}</p><p className="text-xs text-muted-foreground mt-1">Grade</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-3xl font-black text-blue-600">{stats.pc}</p><p className="text-xs text-muted-foreground mt-1">PC (Escavadeira)</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-3xl font-black text-green-600">{stats.byStatus.completed}</p><p className="text-xs text-muted-foreground mt-1">Finalizados</p></CardContent></Card>
          </div>

          {/* Warnings */}
          {(stats.unmatched.settlement > 0 || stats.unmatched.machinery > 0 || stats.unmatched.operator > 0) && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  Itens sem correspondência (serão importados sem o vínculo)
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
                {stats.unmatched.settlement > 0 && <p>• {stats.unmatched.settlement} assentamentos não encontrados no cadastro</p>}
                {stats.unmatched.machinery > 0 && <p>• {stats.unmatched.machinery} registros com maquinário não cadastrado</p>}
                {stats.unmatched.operator > 0 && <p>• {stats.unmatched.operator} registros com operador não encontrado</p>}
              </CardContent>
            </Card>
          )}

          {/* Preview table */}
          <div className="rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    {['Aba','Produtor','Assentamento','Status','Trator','Operador','Área(ha)','Data Cad.'].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {previewRows.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={row.sheet === 'grade' ? 'text-amber-600 border-amber-300' : 'text-blue-600 border-blue-300'}>
                          {row.sheet === 'grade' ? 'Grade' : 'PC'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 max-w-[140px] truncate font-medium">{row.producerName}</td>
                      <td className="px-3 py-2">
                        <span className={row.settlementMatch === 'none' && row.settlementName ? 'text-amber-600' : ''}>
                          {row.settlementName || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={
                          row.status === 'completed' ? 'text-green-600 border-green-300' :
                          row.status === 'in_progress' ? 'text-blue-600 border-blue-300' :
                          'text-amber-600 border-amber-300'
                        }>
                          {row.status === 'completed' ? 'Finalizado' : row.status === 'in_progress' ? 'Em Execução' : 'Pendente'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <span className={row.machineryMatch === 'none' && row.tractorName ? 'text-amber-600' : row.machineryId ? 'text-green-600' : 'text-muted-foreground'}>
                          {row.tractorName || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={row.operatorMatch === 'none' && row.operatorName ? 'text-amber-600' : row.operatorId ? 'text-green-600' : 'text-muted-foreground'}>
                          {row.operatorName || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2">{row.workedArea ?? '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {row.cadastroDate ? row.cadastroDate.toLocaleDateString('pt-BR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows && rows.length > 10 && (
              <div className="p-3 border-t bg-muted/20 text-center">
                <Button variant="ghost" size="sm" onClick={() => setShowAll(v => !v)}>
                  {showAll ? <><ChevronUp className="h-4 w-4 mr-1" />Mostrar menos</> : <><ChevronDown className="h-4 w-4 mr-1" />Mostrar todos ({rows.length})</>}
                </Button>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button onClick={handleImport} disabled={importing} size="lg">
              {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importando...</> : `Importar ${stats.total} registros`}
            </Button>
            <Button variant="outline" onClick={() => { setRows(null); setResult(null); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4 max-w-lg">
          <Card className={result.imported > 0 ? 'border-green-200 bg-green-50 dark:bg-green-950/20' : 'border-destructive/30 bg-destructive/5'}>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
                <div>
                  <p className="text-xl font-black">{result.imported} importados</p>
                  <p className="text-sm text-muted-foreground">{result.skipped} ignorados</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="space-y-1 text-xs text-destructive border-t pt-3">
                  <p className="font-medium flex items-center gap-1"><XCircle className="h-3 w-3" />{result.errors.length} erros:</p>
                  {result.errors.slice(0, 5).map((e, i) => <p key={i} className="opacity-80">• {e}</p>)}
                  {result.errors.length > 5 && <p className="opacity-60">...e mais {result.errors.length - 5}</p>}
                </div>
              )}
            </CardContent>
          </Card>
          <Button onClick={() => { setRows(null); setResult(null); }}>
            Importar outro arquivo
          </Button>
        </div>
      )}
    </AppLayout>
  );
}
