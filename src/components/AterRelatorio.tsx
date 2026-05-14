/**
 * AterRelatorio.tsx
 *
 * Settings-page card for generating the "Relatório Técnico Consolidado de
 * Comprovação de Prestação de ATER" (PDF and Excel formats).
 *
 * Data source: all completed services (status = 'completed') that have a
 * responsible_technician_id set, filtered by the selected year.
 *
 * Output:
 *   • PDF  → landscape A4, one section per technician, auto page-break
 *   • Excel → mirrors the official CONFRESA/MT template structure,
 *             with continuation blocks when a technician exceeds 147 rows
 */

import { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileDown, FileSpreadsheet, Loader2, ClipboardCheck, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  fetchAterData,
  generateAterExcel,
  generateAterPDF,
  type TechnicianGroup,
} from '@/utils/aterReport';

// ─── Year options ─────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].filter((y) => y >= 2024);

// ─── Component ────────────────────────────────────────────────────────────────

export function AterRelatorio() {
  const { toast } = useToast();

  const [selectedYear, setSelectedYear] = useState(String(CURRENT_YEAR));
  const [loadingPDF, setLoadingPDF] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);
  /** Cached groups from the last fetch (for the current year selection) */
  const [cachedGroups, setCachedGroups] = useState<TechnicianGroup[] | null>(null);
  const [cachedYear, setCachedYear] = useState<number | null>(null);

  const isLoading = loadingPDF || loadingExcel;

  // ── Fetch data (cached per year) ────────────────────────────────────────────
  const getData = useCallback(
    async (year: number): Promise<TechnicianGroup[]> => {
      if (cachedYear === year && cachedGroups !== null) return cachedGroups;
      const groups = await fetchAterData(year);
      setCachedGroups(groups);
      setCachedYear(year);
      return groups;
    },
    [cachedGroups, cachedYear],
  );

  // ── Generate handlers ────────────────────────────────────────────────────────
  const handleGenerate = useCallback(
    async (format: 'pdf' | 'excel') => {
      const year = parseInt(selectedYear, 10);
      const setLoading = format === 'pdf' ? setLoadingPDF : setLoadingExcel;
      setLoading(true);

      try {
        const groups = await getData(year);

        if (groups.length === 0) {
          toast({
            title: 'Nenhum dado encontrado',
            description: `Sem atendimentos finalizados com responsável técnico vinculado em ${year}. Verifique se os atendimentos estão com o campo "Resp. Técnico" preenchido.`,
            variant: 'destructive',
          });
          return;
        }

        const totalServices = groups.reduce((acc, g) => acc + g.services.length, 0);

        if (format === 'pdf') {
          generateAterPDF(groups, year);
        } else {
          generateAterExcel(groups, year);
        }

        toast({
          title: 'Relatório gerado com sucesso!',
          description: `${totalServices} atendimento(s) — ${groups.length} responsável(is) técnico(s) — ${year}`,
        });
      } catch (err: any) {
        toast({
          title: 'Erro ao gerar relatório',
          description: err?.message ?? 'Verifique os dados e tente novamente.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [selectedYear, getData, toast],
  );

  // Invalidate cache when year changes
  const handleYearChange = (v: string) => {
    setSelectedYear(v);
    if (parseInt(v, 10) !== cachedYear) {
      setCachedGroups(null);
      setCachedYear(null);
    }
  };

  // ── Summary stats (from cache if available) ──────────────────────────────────
  const year = parseInt(selectedYear, 10);
  const summary =
    cachedYear === year && cachedGroups
      ? {
          technicians: cachedGroups.length,
          services: cachedGroups.reduce((acc, g) => acc + g.services.length, 0),
        }
      : null;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          Relatório de ATER
        </CardTitle>
        <CardDescription>
          Gere o Relatório Técnico Consolidado de Comprovação de Prestação de Assistência Técnica
          e Extensão Rural, agrupado por responsável técnico
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Year selector */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1.5 w-[130px]">
            <label className="text-sm font-medium">Ano Civil</label>
            <Select value={selectedYear} onValueChange={handleYearChange}>
              <SelectTrigger>
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Cached summary (shown after first generation) */}
        {summary && summary.services > 0 && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-xs">
              {summary.technicians} responsável(is) técnico(s)
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {summary.services} atendimento(s) finalizado(s)
            </Badge>
          </div>
        )}

        {/* Info note */}
        <div className="flex gap-2 items-start p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
          <span>
            Inclui apenas atendimentos com <strong>Status = Finalizado</strong> e com{' '}
            <strong>Responsável Técnico</strong> vinculado. Para cada técnico com mais de 147
            registros, blocos de continuação são adicionados automaticamente.
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => handleGenerate('pdf')}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {loadingPDF ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            {loadingPDF ? 'Gerando PDF…' : 'Gerar PDF'}
          </Button>

          <Button
            variant="outline"
            onClick={() => handleGenerate('excel')}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {loadingExcel ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-2" />
            )}
            {loadingExcel ? 'Exportando…' : 'Exportar Excel'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
