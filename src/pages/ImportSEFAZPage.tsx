import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle, AlertTriangle, XCircle, Upload, Users, ClipboardList,
  MapPin, ArrowLeft, Loader2, Info,
} from 'lucide-react';
import { useSettlements, useSefazProducers } from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';
import { SEFAZ_2026_DATA, type SefazRow } from '@/data/sefaz2026Import';
import { cn } from '@/lib/utils';

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Normalize a settlement name for fuzzy matching */
function normalizeSettle(name: string) {
  return name
    .toLowerCase()
    .replace(/^pa\s+/i, '')           // remove "PA " prefix
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // remove accents
    .replace(/\s+/g, ' ')
    .trim();
}

/** Build a map: normalizedRawName → settlement_id */
function buildSettlementMap(dbSettlements: any[]): Map<string, { id: string; name: string }> {
  const map = new Map<string, { id: string; name: string }>();
  dbSettlements.forEach((s: any) => {
    map.set(normalizeSettle(s.name), { id: s.id, name: s.name });
  });
  return map;
}

/** Match a raw settlement string to a DB settlement */
function matchSettlement(
  raw: string,
  map: Map<string, { id: string; name: string }>,
): { id: string; name: string } | null {
  const key = normalizeSettle(raw);
  // 1. Exact
  if (map.has(key)) return map.get(key)!;
  // 2. Partial — DB name contains key
  for (const [dbKey, val] of map) {
    if (dbKey.includes(key) || key.includes(dbKey)) return val;
  }
  return null;
}

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril'] as const;
const MONTH_LABELS: Record<string, string> = {
  Janeiro: 'Janeiro/2026',
  Fevereiro: 'Fevereiro/2026',
  Março: 'Março/2026',
  Abril: 'Abril/2026',
};
const MONTH_BADGE_COLOR: Record<string, string> = {
  Janeiro:   'bg-blue-100 text-blue-800',
  Fevereiro: 'bg-violet-100 text-violet-800',
  Março:     'bg-amber-100 text-amber-800',
  Abril:     'bg-emerald-100 text-emerald-800',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportSEFAZPage() {
  const navigate = useNavigate();
  const { data: rawSettlements = [], isLoading: loadingSettlements } = useSettlements();
  const { data: existingProducers = [], isLoading: loadingProducers } = useSefazProducers();

  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [importing, setImporting]       = useState(false);
  const [done, setDone]                 = useState(false);
  const [progress, setProgress]         = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [errors, setErrors]             = useState<string[]>([]);
  const [log, setLog]                   = useState<string[]>([]);

  const isLoading = loadingSettlements || loadingProducers;

  // Build settlement matching map from DB
  const settlementMap = useMemo(
    () => buildSettlementMap(rawSettlements as any[]),
    [rawSettlements],
  );

  // Enrich each row with matched settlement and existing-producer flag
  const enriched = useMemo(() => {
    const existingCpfs = new Set(
      (existingProducers as any[]).map((p: any) => p.cpf).filter(Boolean),
    );
    return SEFAZ_2026_DATA.map((row) => {
      const settlement = row.settlement_raw ? matchSettlement(row.settlement_raw, settlementMap) : null;
      const producerExists = row.cpf ? existingCpfs.has(row.cpf) : false;
      return { ...row, settlement, producerExists };
    });
  }, [settlementMap, existingProducers]);

  // Stats
  const stats = useMemo(() => {
    const filtered = filterMonth === 'all' ? enriched : enriched.filter((r) => r.month === filterMonth);
    const uniqueCpfs = new Set(filtered.map((r) => r.cpf || r.name));
    const matched   = filtered.filter((r) => r.settlement !== null).length;
    const unmatched = filtered.filter((r) => r.settlement === null).length;
    const newProducers = new Set(filtered.filter((r) => !r.producerExists).map((r) => r.cpf || r.name)).size;
    return { total: filtered.length, matched, unmatched, uniqueProducers: uniqueCpfs.size, newProducers };
  }, [enriched, filterMonth]);

  // Rows for display (respect filter)
  const displayRows = useMemo(
    () => filterMonth === 'all' ? enriched : enriched.filter((r) => r.month === filterMonth),
    [enriched, filterMonth],
  );

  // ── Import handler ─────────────────────────────────────────────────────────

  const handleImport = async () => {
    setImporting(true);
    setDone(false);
    setErrors([]);
    setLog([]);
    setProgress(0);
    setImportedCount(0);

    const rowsToImport = filterMonth === 'all'
      ? enriched
      : enriched.filter((r) => r.month === filterMonth);

    // Build producer cache (cpf → id) from existing producers
    const producerCache: Record<string, string> = {};
    (existingProducers as any[]).forEach((p: any) => {
      if (p.cpf) producerCache[p.cpf] = p.id;
    });

    const newErrors: string[] = [];
    const newLog: string[]    = [];
    let imported = 0;
    const { data: { user } } = await supabase.auth.getUser();

    for (let i = 0; i < rowsToImport.length; i++) {
      const row = rowsToImport[i];
      setProgress(Math.round(((i + 1) / rowsToImport.length) * 100));

      try {
        // ── 1. Ensure producer exists ──────────────────────────────────────
        let producerId: string;

        if (row.cpf && producerCache[row.cpf]) {
          producerId = producerCache[row.cpf];
        } else {
          // Create new producer
          const { data: newP, error: pErr } = await supabase
            .from('sefaz_producers' as any)
            .insert({
              name: row.name,
              cpf: row.cpf || null,
              phone: row.phone || null,
              settlement_id: row.settlement?.id || null,
              location: row.settlement_raw || null,
            })
            .select('id')
            .single();

          if (pErr) throw new Error(`Produtor "${row.name}": ${pErr.message}`);

          producerId = (newP as any).id;
          if (row.cpf) producerCache[row.cpf] = producerId;
          newLog.push(`✓ Produtor criado: ${row.name}`);
        }

        // ── 2. Create service record ───────────────────────────────────────
        const { error: sErr } = await supabase
          .from('sefaz_services' as any)
          .insert({
            sefaz_producer_id: producerId,
            service_type: 'Nota Fiscal',
            service_date: row.service_date,
            signed_list: row.signed,
            notes: null,
          });

        if (sErr) throw new Error(`Atendimento de "${row.name}" (${row.month}): ${sErr.message}`);

        imported++;
      } catch (err: any) {
        newErrors.push(err.message);
      }
    }

    setImportedCount(imported);
    setErrors(newErrors);
    setLog(newLog);
    setImporting(false);
    setDone(true);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader
          title="Importar SEFAZ 2026"
          description="Analisando dados..."
        />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Importar Atendimentos SEFAZ 2026"
        description="Planilha: Registro de atendimentos SEFAZ — Janeiro a Abril/2026"
        action={{
          label: 'Voltar ao SEFAZ',
          onClick: () => navigate('/sefaz'),
          icon: <ArrowLeft className="h-4 w-4 mr-2" />,
        }}
      />

      {/* ── Result banner ── */}
      {done && (
        <div className={cn(
          'mb-4 rounded-xl border p-4 flex items-start gap-3',
          errors.length === 0
            ? 'border-success/30 bg-success/10'
            : 'border-warning/30 bg-warning/10',
        )}>
          {errors.length === 0
            ? <CheckCircle className="h-5 w-5 text-success shrink-0 mt-0.5" />
            : <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          }
          <div>
            <p className="font-semibold">
              {importedCount} atendimento{importedCount !== 1 ? 's' : ''} importado{importedCount !== 1 ? 's' : ''}
              {errors.length > 0 ? ` · ${errors.length} erro${errors.length !== 1 ? 's' : ''}` : ' com sucesso!'}
            </p>
            {errors.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {errors.slice(0, 10).map((e, i) => (
                  <li key={i} className="text-xs text-destructive">• {e}</li>
                ))}
                {errors.length > 10 && (
                  <li className="text-xs text-muted-foreground">...e mais {errors.length - 10} erros</li>
                )}
              </ul>
            )}
            {log.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{log.length} novos produtores criados</p>
            )}
          </div>
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><ClipboardList className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Atendimentos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10"><Users className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold">{stats.uniqueProducers}</p>
              <p className="text-xs text-muted-foreground">Produtores únicos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10"><MapPin className="h-5 w-5 text-success" /></div>
            <div>
              <p className="text-2xl font-bold">{stats.matched}</p>
              <p className="text-xs text-muted-foreground">Com assentamento</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10"><AlertTriangle className="h-5 w-5 text-warning" /></div>
            <div>
              <p className="text-2xl font-bold">{stats.unmatched}</p>
              <p className="text-xs text-muted-foreground">Sem assentamento</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Settlement match info ── */}
      {stats.unmatched > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/5 p-3 text-sm text-info mb-4">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {stats.unmatched} registro(s) não encontraram assentamento correspondente no cadastro.
            Eles serão importados com o campo assentamento em branco (você pode editar depois).
          </span>
        </div>
      )}

      {/* ── Controls ── */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses ({SEFAZ_2026_DATA.length})</SelectItem>
            {MONTHS.map((m) => {
              const count = SEFAZ_2026_DATA.filter((r) => r.month === m).length;
              return (
                <SelectItem key={m} value={m}>{MONTH_LABELS[m]} ({count})</SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Button
          onClick={handleImport}
          disabled={importing || done}
          className="gap-2 ml-auto"
        >
          {importing ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Importando... {progress}%</>
          ) : done ? (
            <><CheckCircle className="h-4 w-4" />Concluído</>
          ) : (
            <><Upload className="h-4 w-4" />Importar {stats.total} registros</>
          )}
        </Button>
      </div>

      {/* ── Progress bar ── */}
      {importing && (
        <div className="mb-4 space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">{progress}% concluído</p>
        </div>
      )}

      {/* ── Preview table ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Pré-visualização
            <Badge variant="secondary" className="ml-1">{displayRows.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/90 z-10">
                <tr className="border-b">
                  <th className="text-left p-2.5 font-medium text-muted-foreground text-xs whitespace-nowrap">Mês</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground text-xs">Nome</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground text-xs hidden sm:table-cell">CPF / CNPJ</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground text-xs hidden md:table-cell">Telefone</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground text-xs">Assentamento</th>
                  <th className="text-center p-2.5 font-medium text-muted-foreground text-xs">Assinou</th>
                  <th className="text-center p-2.5 font-medium text-muted-foreground text-xs whitespace-nowrap">Produtor</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="p-2.5">
                      <Badge className={cn('text-xs whitespace-nowrap', MONTH_BADGE_COLOR[row.month])} variant="secondary">
                        {row.month}
                      </Badge>
                    </td>
                    <td className="p-2.5 font-medium max-w-[180px]">
                      <span className="truncate block">{row.name}</span>
                    </td>
                    <td className="p-2.5 text-muted-foreground text-xs tabular-nums hidden sm:table-cell whitespace-nowrap">
                      {row.cpf || <span className="text-warning/80 italic">sem CPF</span>}
                    </td>
                    <td className="p-2.5 text-muted-foreground text-xs tabular-nums hidden md:table-cell whitespace-nowrap">
                      {row.phone || '—'}
                    </td>
                    <td className="p-2.5 max-w-[200px]">
                      {row.settlement ? (
                        <div>
                          <span className="text-xs font-medium text-success">{row.settlement.name}</span>
                          {row.settlement.name !== row.settlement_raw && (
                            <span className="text-xs text-muted-foreground block truncate">{row.settlement_raw}</span>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="text-xs text-warning">sem correspondência</span>
                          <span className="text-xs text-muted-foreground block truncate">{row.settlement_raw || '—'}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-2.5 text-center">
                      {row.signed
                        ? <CheckCircle className="h-4 w-4 text-success mx-auto" />
                        : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                      }
                    </td>
                    <td className="p-2.5 text-center">
                      {row.producerExists
                        ? <Badge variant="outline" className="text-xs text-success border-success/30">existente</Badge>
                        : <Badge variant="secondary" className="text-xs">novo</Badge>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
