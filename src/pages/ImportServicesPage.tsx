import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  useDemandTypes,
  useSettlements,
  useMachinery,
  useResponsibleTechnicians,
} from '@/hooks/useSupabaseData';
import {
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileDown,
  RotateCcw,
  Info,
  CircleCheck,
} from 'lucide-react';
import {
  downloadImportTemplate,
} from '@/utils/importTemplate';
import {
  parseImportFile,
  downloadValidationReport,
  type ParsedRow,
  type NamedRecord,
  norm,
} from '@/utils/importParser';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

type Step = 1 | 2 | 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract column name from a PostgREST "missing column" error */
function extractMissingColumn(message: string): string | null {
  const m1 = message.match(/find the '(\w+)' column/);
  if (m1) return m1[1];
  const m2 = message.match(/column "(\w+)" of relation/);
  if (m2) return m2[1];
  return null;
}

/** Bulk-insert with automatic retry when PostgREST reports a missing column */
async function bulkInsertWithRetry(
  table: string,
  records: Record<string, unknown>[],
): Promise<{ data: { id: string }[] | null; error: { message: string } | null }> {
  let current = [...records];
  for (let attempt = 0; attempt <= 8; attempt++) {
    const res = await supabase.from(table).insert(current).select('id');
    if (!res.error) return res as { data: { id: string }[]; error: null };

    const missing = extractMissingColumn(res.error.message);
    if (missing && current[0] && missing in current[0]) {
      current = current.map(({ [missing]: _dropped, ...rest }) => rest);
      continue;
    }
    return res as { data: null; error: { message: string } };
  }
  return { data: null, error: { message: 'Máximo de tentativas atingido.' } };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ImportServicesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: demandTypesRaw = [] } = useDemandTypes();
  const { data: settlementsRaw = [] } = useSettlements();
  const { data: machineryRaw = [] } = useMachinery();
  const { data: techniciansRaw = [] } = useResponsibleTechnicians();

  const [operators, setOperators] = useState<NamedRecord[]>([]);
  const operatorsFetched = useRef(false);

  useEffect(() => {
    if (operatorsFetched.current) return;
    operatorsFetched.current = true;

    supabase
      .from('user_roles')
      .select('user_id, profiles!user_id(id, name)')
      .eq('role', 'operator')
      .then(({ data }) => {
        if (data) {
          setOperators(
            data
              .map((r: any) => r.profiles)
              .filter((p: any): p is NamedRecord => !!p?.id && !!p?.name),
          );
        }
      });
  }, []);

  // Normalise reference lists to NamedRecord[]
  const demandTypes = useMemo(
    () => (demandTypesRaw as any[]).map((d) => ({ id: d.id, name: d.name })) as NamedRecord[],
    [demandTypesRaw],
  );
  const settlements = useMemo(
    () => (settlementsRaw as any[]).map((s) => ({ id: s.id, name: s.name })) as NamedRecord[],
    [settlementsRaw],
  );
  const machinery = useMemo(
    () => (machineryRaw as any[]).map((m) => ({ id: m.id, name: m.name })) as NamedRecord[],
    [machineryRaw],
  );
  const technicians = useMemo(
    () => (techniciansRaw as any[]).map((t) => ({ id: t.id, name: t.name })) as NamedRecord[],
    [techniciansRaw],
  );

  // ── UI state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [showAllPreview, setShowAllPreview] = useState(false);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!rows) return null;
    const valid = rows.filter((r) => r.willImport).length;
    const withErrors = rows.filter((r) => r.errors.length > 0).length;
    const duplicates = rows.filter((r) => r.isDuplicate).length;
    const withWarnings = rows.filter((r) => r.willImport && r.warnings.length > 0).length;
    return { total: rows.length, valid, withErrors, duplicates, withWarnings };
  }, [rows]);

  // ── Parse file ────────────────────────────────────────────────────────────
  const parseFile = useCallback(
    async (file: File) => {
      setParseError(null);
      setRows(null);

      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast({ title: 'Formato inválido', description: 'Selecione um arquivo .xlsx', variant: 'destructive' });
        return;
      }

      try {
        const buf = await file.arrayBuffer();
        const result = parseImportFile(buf, {
          demandTypes,
          settlements,
          machinery,
          operators,
          technicians,
        });

        if (result.rows.length === 0) {
          setParseError('Nenhuma linha de dados encontrada. Verifique se o arquivo está usando o modelo correto.');
          return;
        }

        setRows(result.rows);
        setStep(2);
      } catch (err: any) {
        setParseError(err.message ?? 'Erro ao processar o arquivo.');
        toast({ title: 'Erro ao ler arquivo', description: err.message, variant: 'destructive' });
      }
    },
    [demandTypes, settlements, machinery, operators, technicians, toast],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) parseFile(file);
    },
    [parseFile],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = '';
  };

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!rows) return;
    const validRows = rows.filter((r) => r.willImport);
    if (validRows.length === 0) return;

    setImporting(true);
    setImportStatus('Verificando autenticação…');

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const createdBy = user?.id ?? null;

    // ── Step A: upsert unique producers ───────────────────────────
    setImportStatus(`Sincronizando produtores…`);

    const uniqueProducers = new Map<string, { name: string; cpf: string; phone: string }>();
    for (const row of validRows) {
      const key = row.cpf || norm(row.producerName);
      if (key && !uniqueProducers.has(key)) {
        uniqueProducers.set(key, { name: row.producerName, cpf: row.cpf, phone: row.phone });
      }
    }

    const producerMap = new Map<string, string>(); // key → producer_id

    for (const [key, p] of uniqueProducers) {
      try {
        let existingId: string | null = null;

        if (p.cpf) {
          const { data } = await supabase
            .from('producers')
            .select('id')
            .eq('cpf', p.cpf)
            .maybeSingle();
          existingId = data?.id ?? null;
        }
        if (!existingId) {
          const { data } = await supabase
            .from('producers')
            .select('id')
            .ilike('name', p.name)
            .maybeSingle();
          existingId = data?.id ?? null;
        }

        if (existingId) {
          producerMap.set(key, existingId);
        } else {
          const insertData: Record<string, unknown> = { name: p.name };
          if (p.cpf) insertData.cpf = p.cpf;
          if (p.phone) insertData.phone = p.phone;
          const { data, error } = await supabase
            .from('producers')
            .insert(insertData)
            .select('id')
            .single();
          if (error) throw error;
          producerMap.set(key, data.id);
        }
      } catch {
        // Non-fatal: row will fail service insert and be counted as skipped
      }
    }

    // ── Step B: upsert unique locations ──────────────────────────
    setImportStatus('Sincronizando localidades…');

    const uniqueLocations = new Map<string, { settlId: string; locName: string }>();
    for (const row of validRows) {
      if (!row.settlementId || !row.locationName) continue;
      const key = `${row.settlementId}|${row.locationName}`;
      if (!uniqueLocations.has(key)) {
        uniqueLocations.set(key, { settlId: row.settlementId, locName: row.locationName });
      }
    }

    const locationMap = new Map<string, string>(); // "settlId|locName" → location_id

    for (const [key, loc] of uniqueLocations) {
      try {
        const { data: existing } = await supabase
          .from('locations')
          .select('id')
          .eq('settlement_id', loc.settlId)
          .ilike('name', loc.locName)
          .maybeSingle();

        if (existing) {
          locationMap.set(key, existing.id);
        } else {
          const { data, error } = await supabase
            .from('locations')
            .insert({ name: loc.locName, settlement_id: loc.settlId })
            .select('id')
            .single();
          if (!error && data) locationMap.set(key, data.id);
        }
      } catch {
        // Non-fatal
      }
    }

    // ── Step C: build service records ────────────────────────────
    setImportStatus(`Preparando ${validRows.length} atendimentos…`);

    const serviceRecords: Record<string, unknown>[] = [];

    for (const row of validRows) {
      if (!row.scheduledDate || !row.status || !row.demandTypeId) continue;

      const producerKey = row.cpf || norm(row.producerName);
      const producerId = producerMap.get(producerKey);
      if (!producerId) continue;

      const locationKey =
        row.settlementId && row.locationName
          ? `${row.settlementId}|${row.locationName}`
          : null;
      const locationId = locationKey ? (locationMap.get(locationKey) ?? null) : null;

      const record: Record<string, unknown> = {
        producer_id: producerId,
        demand_type_id: row.demandTypeId,
        settlement_id: row.settlementId ?? null,
        location_id: locationId ?? null,
        scheduled_date: row.scheduledDate.toISOString().slice(0, 10),
        status: row.status,
        created_by: createdBy,
      };

      if (row.priority) record.priority = row.priority;
      if (row.workedArea != null) record.worked_area = row.workedArea;
      if (row.limestoneQuantity != null) record.limestone_quantity = row.limestoneQuantity;
      if (row.inputQuantity != null) record.input_quantity = row.inputQuantity;
      if (row.machineryId) record.machinery_id = row.machineryId;
      if (row.operatorId) record.operator_id = row.operatorId;
      if (row.technicianId) record.responsible_technician_id = row.technicianId;
      if (row.damIssued != null) record.dam_issued = row.damIssued;
      if (row.damPaid != null) record.dam_paid = row.damPaid;
      if (row.notes) record.notes = row.notes;
      if (row.registeredDate) record.created_at = row.registeredDate.toISOString();
      if (row.status === 'completed' && row.completedDate) {
        record.completed_at = row.completedDate.toISOString();
        record.appointment_date = row.completedDate.toISOString().slice(0, 10);
      }

      serviceRecords.push(record);
    }

    // ── Step D: bulk insert (atomic) ──────────────────────────────
    setImportStatus(`Importando ${serviceRecords.length} atendimentos…`);

    const { data: inserted, error: insertError } = await bulkInsertWithRetry(
      'services',
      serviceRecords,
    );

    setImporting(false);

    if (insertError) {
      setResult({
        imported: 0,
        skipped: serviceRecords.length,
        errors: [insertError.message],
      });
    } else {
      const importedCount = inserted?.length ?? serviceRecords.length;
      const skipped = validRows.length - importedCount + (rows.length - validRows.length);
      setResult({
        imported: importedCount,
        skipped,
        errors: [],
      });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['producers'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast({ title: `${importedCount} atendimentos importados com sucesso!` });
    }

    setStep(3);
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setStep(1);
    setRows(null);
    setResult(null);
    setParseError(null);
    setShowAllErrors(false);
    setShowAllPreview(false);
    setImportStatus('');
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const errorRows = rows?.filter((r) => r.errors.length > 0) ?? [];
  const duplicateRows = rows?.filter((r) => r.isDuplicate) ?? [];
  const warningOnlyRows = rows?.filter((r) => r.willImport && r.warnings.length > 0) ?? [];
  const validRows = rows?.filter((r) => r.willImport) ?? [];
  const previewRows = showAllPreview ? validRows : validRows.slice(0, 10);

  const statusBadgeClass = (s: string | null) => {
    switch (s) {
      case 'completed': return 'text-green-600 border-green-300 bg-green-50';
      case 'in_progress': return 'text-blue-600 border-blue-300 bg-blue-50';
      case 'proximo': return 'text-purple-600 border-purple-300 bg-purple-50';
      default: return 'text-amber-600 border-amber-300 bg-amber-50';
    }
  };
  const statusLabel = (s: string | null) => {
    switch (s) {
      case 'completed': return 'Finalizado';
      case 'in_progress': return 'Em Execução';
      case 'proximo': return 'Próximo';
      default: return 'Pendente';
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <PageHeader
        title="Importar Planilha"
        description="Importe atendimentos em massa a partir de uma planilha Excel"
      />

      {/* ── Step indicator ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        {(['Upload', 'Revisão', 'Resultado'] as const).map((label, idx) => {
          const n = (idx + 1) as Step;
          const active = step === n;
          const done = step > n;
          return (
            <div key={label} className="flex items-center gap-2">
              {idx > 0 && <div className="h-px w-6 bg-border" />}
              <div className={`flex items-center gap-1.5 font-medium ${
                active ? 'text-primary' : done ? 'text-muted-foreground' : 'text-muted-foreground/50'
              }`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold
                  ${active ? 'bg-primary text-primary-foreground' : done ? 'bg-muted text-muted-foreground' : 'bg-muted/40 text-muted-foreground/40'}`}>
                  {done ? <CircleCheck className="h-3.5 w-3.5" /> : n}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══════════════════ STEP 1 — Upload ══════════════════════ */}
      {step === 1 && (
        <div className="space-y-4 max-w-2xl">
          {/* Template download */}
          <Card>
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-green-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Baixe o modelo antes de importar</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Template padronizado com todas as colunas e aba de referência
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadImportTemplate} className="shrink-0">
                <Download className="h-4 w-4 mr-2" />
                Baixar modelo .xlsx
              </Button>
            </CardContent>
          </Card>

          {/* File drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => document.getElementById('xlsx-input')?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors select-none ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-muted/20'
            }`}
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-semibold mb-1">Arraste o arquivo .xlsx aqui</p>
            <p className="text-sm text-muted-foreground mb-4">ou clique para selecionar</p>
            <Button variant="outline" type="button" size="sm" onClick={(e) => e.stopPropagation()}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Selecionar arquivo
            </Button>
            <input
              id="xlsx-input"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {/* Parse error */}
          {parseError && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="p-4 flex gap-3 items-start">
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-destructive text-sm">Erro ao processar arquivo</p>
                  <p className="text-sm text-muted-foreground mt-1">{parseError}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info */}
          <Card className="bg-muted/30 border-0">
            <CardContent className="p-4 flex gap-3 items-start text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
              <div className="space-y-1">
                <p>Use o modelo oficial para garantir o mapeamento correto das colunas.</p>
                <p>O sistema detecta automaticamente a linha de cabeçalho — não é necessário ajustar o arquivo.</p>
                <p>Campos obrigatórios: <strong>Produtor</strong>, <strong>Tipo de Serviço</strong>, <strong>Status</strong> e <strong>Data Agendamento</strong>.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════ STEP 2 — Review ══════════════════════ */}
      {step === 2 && rows && stats && (
        <div className="space-y-5">

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-black">{stats.total}</p>
                <p className="text-xs text-muted-foreground mt-1">Linhas lidas</p>
              </CardContent>
            </Card>
            <Card className="border-green-200">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-black text-green-600">{stats.valid}</p>
                <p className="text-xs text-muted-foreground mt-1">Prontas p/ importar</p>
              </CardContent>
            </Card>
            <Card className={stats.withErrors > 0 ? 'border-destructive/40' : ''}>
              <CardContent className="p-4 text-center">
                <p className={`text-3xl font-black ${stats.withErrors > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {stats.withErrors}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Com erros</p>
              </CardContent>
            </Card>
            <Card className={stats.duplicates > 0 ? 'border-amber-200' : ''}>
              <CardContent className="p-4 text-center">
                <p className={`text-3xl font-black ${stats.duplicates > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  {stats.duplicates}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Duplicados</p>
              </CardContent>
            </Card>
          </div>

          {/* Warning banner — items that will be imported with warnings */}
          {stats.withWarnings > 0 && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="p-4 flex gap-3 items-start">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <p className="font-semibold">
                    {stats.withWarnings} linha{stats.withWarnings > 1 ? 's serão importadas' : ' será importada'} com avisos
                  </p>
                  <p className="text-xs mt-0.5 opacity-80">
                    Assentamentos, maquinários, operadores ou técnicos não encontrados no cadastro.
                    Os atendimentos serão importados sem esses vínculos.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error rows */}
          {errorRows.length > 0 && (
            <div className="rounded-xl border border-destructive/30 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-destructive/5 border-b border-destructive/20">
                <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <XCircle className="h-4 w-4" />
                  {errorRows.length} linha{errorRows.length > 1 ? 's' : ''} com erros — não serão importadas
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setShowAllErrors((v) => !v)}
                >
                  {showAllErrors ? (
                    <><ChevronUp className="h-3 w-3 mr-1" />Recolher</>
                  ) : (
                    <><ChevronDown className="h-3 w-3 mr-1" />Ver detalhes</>
                  )}
                </Button>
              </div>
              {showAllErrors && (
                <div className="divide-y text-xs">
                  {errorRows.map((row) => (
                    <div key={row.rowNum} className="px-4 py-2.5 flex gap-3 items-start">
                      <span className="text-muted-foreground shrink-0 tabular-nums w-12">
                        Linha {row.rowNum}
                      </span>
                      <span className="font-medium min-w-0 truncate w-36 shrink-0">
                        {row.producerName || '(sem nome)'}
                      </span>
                      <div className="text-destructive space-y-0.5 min-w-0">
                        {row.errors.map((e, i) => (
                          <p key={i}>• {e}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Duplicate rows */}
          {duplicateRows.length > 0 && (
            <Card className="border-amber-200/60">
              <CardContent className="p-4 flex gap-3 items-start text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-700 dark:text-amber-400">
                    {duplicateRows.length} linha{duplicateRows.length > 1 ? 's duplicadas ignoradas' : ' duplicada ignorada'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mesmo produtor + tipo de serviço + data: somente o primeiro registro é mantido.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preview of valid rows */}
          {validRows.length > 0 && (
            <div className="rounded-xl border overflow-hidden">
              <div className="px-4 py-3 bg-muted/40 border-b flex items-center justify-between">
                <span className="text-sm font-semibold">
                  Preview — {validRows.length} registro{validRows.length > 1 ? 's' : ''} válido{validRows.length > 1 ? 's' : ''}
                </span>
                {validRows.length > 10 && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowAllPreview((v) => !v)}>
                    {showAllPreview ? (
                      <><ChevronUp className="h-3 w-3 mr-1" />Mostrar menos</>
                    ) : (
                      <><ChevronDown className="h-3 w-3 mr-1" />Ver todos ({validRows.length})</>
                    )}
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30">
                    <tr>
                      {['Produtor', 'Tipo de Serviço', 'Status', 'Data', 'Assentamento', 'Maquinário', 'Área (ha)'].map(
                        (h) => (
                          <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {previewRows.map((row, i) => (
                      <tr key={i} className={`hover:bg-muted/20 ${row.warnings.length > 0 ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}`}>
                        <td className="px-3 py-2 font-medium max-w-[150px] truncate">
                          {row.producerName}
                          {row.warnings.length > 0 && (
                            <AlertTriangle className="inline-block ml-1 h-3 w-3 text-amber-500" />
                          )}
                        </td>
                        <td className="px-3 py-2 max-w-[140px] truncate">{row.demandTypeName}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={`text-xs ${statusBadgeClass(row.status)}`}>
                            {statusLabel(row.status)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                          {row.scheduledDate?.toLocaleDateString('pt-BR') ?? row.scheduledDateRaw}
                        </td>
                        <td className="px-3 py-2 max-w-[130px] truncate">
                          {row.settlementName ? (
                            <span className={row.settlementMatch === 'none' ? 'text-amber-600' : ''}>
                              {row.settlementName}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 max-w-[120px] truncate">
                          {row.machineryName ? (
                            <span className={row.machineryMatch === 'none' ? 'text-amber-600' : 'text-green-600'}>
                              {row.machineryName}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {row.workedArea ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No valid rows */}
          {stats.valid === 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-6 text-center">
                <XCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
                <p className="font-semibold">Nenhum registro válido para importar</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Corrija os erros no arquivo e tente novamente.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Action bar */}
          <div className="flex flex-wrap gap-3 pt-1">
            <Button
              onClick={handleImport}
              disabled={importing || stats.valid === 0}
              size="lg"
            >
              {importing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{importStatus || 'Importando…'}</>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar {stats.valid} registro{stats.valid !== 1 ? 's' : ''}
                </>
              )}
            </Button>

            {(errorRows.length > 0 || duplicateRows.length > 0 || warningOnlyRows.length > 0) && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => downloadValidationReport(rows)}
                disabled={importing}
              >
                <FileDown className="h-4 w-4 mr-2" />
                Baixar relatório de validação
              </Button>
            )}

            <Button variant="ghost" size="lg" onClick={handleReset} disabled={importing}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════════ STEP 3 — Result ══════════════════════ */}
      {step === 3 && result && (
        <div className="space-y-4 max-w-lg">
          <Card
            className={
              result.errors.length > 0
                ? 'border-destructive/40 bg-destructive/5'
                : 'border-green-300 bg-green-50 dark:bg-green-950/20'
            }
          >
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                {result.errors.length > 0 ? (
                  <XCircle className="h-10 w-10 text-destructive shrink-0" />
                ) : (
                  <CheckCircle2 className="h-10 w-10 text-green-600 shrink-0" />
                )}
                <div>
                  <p className="text-2xl font-black">
                    {result.imported} atendimento{result.imported !== 1 ? 's' : ''} importado{result.imported !== 1 ? 's' : ''}
                  </p>
                  {result.skipped > 0 && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {result.skipped} linha{result.skipped > 1 ? 's' : ''} ignorada{result.skipped > 1 ? 's' : ''} (erros ou sem produtor resolvido)
                    </p>
                  )}
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="border-t pt-4 space-y-1.5 text-sm text-destructive">
                  <p className="font-semibold flex items-center gap-1.5">
                    <XCircle className="h-4 w-4" />
                    {result.errors.length} erro{result.errors.length > 1 ? 's' : ''} durante a importação:
                  </p>
                  {result.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-xs opacity-80">• {e}</p>
                  ))}
                  {result.errors.length > 5 && (
                    <p className="text-xs opacity-60">…e mais {result.errors.length - 5}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Download report if we have the rows */}
          {rows && (
            <Button variant="outline" onClick={() => downloadValidationReport(rows)}>
              <FileDown className="h-4 w-4 mr-2" />
              Baixar relatório de validação
            </Button>
          )}

          <Button onClick={handleReset} size="lg">
            <RotateCcw className="h-4 w-4 mr-2" />
            Importar outro arquivo
          </Button>
        </div>
      )}

      {/* Loading overlay during import */}
      {importing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <Card className="shadow-xl">
            <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div>
                <p className="font-semibold text-lg">Importando…</p>
                <p className="text-sm text-muted-foreground mt-1">{importStatus}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
