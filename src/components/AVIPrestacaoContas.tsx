import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileDown, Loader2, ClipboardList } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useServices, useDemandTypes } from '@/hooks/useSupabaseData';
import { generateAVI, MONTHS_PT, AviService } from '@/utils/aviGenerator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1];

export function AVIPrestacaoContas() {
  const { toast } = useToast();
  const { data: services = [] } = useServices();
  const { data: demandTypes = [] } = useDemandTypes();

  const [selectedMonth, setSelectedMonth] = useState<string>(
    String(new Date().getMonth() + 1),
  );
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    const month = parseInt(selectedMonth, 10);
    const year = parseInt(selectedYear, 10);

    // Filter completed services for the selected month/year
    // Uses completed_at (if set), otherwise falls back to scheduled_date
    const completedServices = services.filter((s: any) => {
      if (s.status !== 'completed') return false;

      // Try completed_at first, then scheduled_date
      const rawDate = s.completed_at || s.scheduled_date;
      if (!rawDate) return false;

      // Parse date robustly (handle "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm:ssZ")
      const d = new Date(rawDate.replace(' ', 'T'));
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });

    // Build AviService list
    const aviServices: AviService[] = completedServices.map((s: any) => {
      const producerName: string = (s.producers?.name || 'PRODUTOR').toUpperCase();
      const settlementName: string = (s.settlements?.name || '').toUpperCase();
      const purpose: string = (s.purpose || '').toUpperCase().trim();
      const demandType = demandTypes.find((d: any) => d.id === s.demand_type_id);
      const demandName: string = (demandType?.name || s.demand_types?.name || '').toUpperCase();

      // Format: ASSISTÊNCIA TÉCNICA PARA {finalidade} A {produtor} EM {assentamento}
      // Falls back to demand type name when no purpose is recorded
      const purposePart = purpose || demandName;
      const description = [
        'ASSISTÊNCIA TÉCNICA',
        purposePart ? `PARA ${purposePart}` : '',
        `A ${producerName}`,
        settlementName ? `EM ${settlementName}` : '',
      ]
        .filter(Boolean)
        .join(' ');

      // Format the completion date
      let dateStr = '';
      const rawDate = s.completed_at || s.scheduled_date;
      if (rawDate) {
        try {
          const d = new Date(rawDate.replace(' ', 'T').replace(/Z$/, '+00:00'));
          dateStr = format(d, 'dd/MM/yyyy', { locale: ptBR });
        } catch {
          dateStr = rawDate.slice(0, 10);
        }
      }

      return { description, date: dateStr };
    });

    // Sort by date ascending
    aviServices.sort((a, b) => {
      const [da, ma, ya] = a.date.split('/').map(Number);
      const [db, mb, yb] = b.date.split('/').map(Number);
      return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
    });

    setLoading(true);
    try {
      const blob = await generateAVI(month, year, aviServices);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AVI_${MONTHS_PT[month]}_${year}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'AVI gerado com sucesso!',
        description: `${aviServices.length} atividade(s) incluída(s) — ${MONTHS_PT[month]}/${year}`,
      });
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar AVI',
        description: err?.message || 'Verifique o template e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Preview count
  const previewCount = services.filter((s: any) => {
    if (s.status !== 'completed') return false;
    const rawDate = s.completed_at || s.scheduled_date;
    if (!rawDate) return false;
    const d = new Date(rawDate.replace(' ', 'T'));
    return (
      d.getFullYear() === parseInt(selectedYear, 10) &&
      d.getMonth() + 1 === parseInt(selectedMonth, 10)
    );
  }).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-5 w-5 text-primary" />
          Prestação de Contas
        </CardTitle>
        <CardDescription>
          Gere o documento AVI (Verba Indenizatória) com as atividades finalizadas do mês
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1.5 flex-1 min-w-[130px]">
            <label className="text-sm font-medium">Mês</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MONTHS_PT).map(([num, name]) => (
                  <SelectItem key={num} value={num}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 w-[110px]">
            <label className="text-sm font-medium">Ano</label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map(y => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {previewCount > 0 ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{previewCount}</span> atendimento(s)
            finalizado(s) em {MONTHS_PT[parseInt(selectedMonth, 10)]}/{selectedYear} serão incluídos.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum atendimento finalizado em {MONTHS_PT[parseInt(selectedMonth, 10)]}/{selectedYear}.
          </p>
        )}

        <Button
          onClick={handleDownload}
          disabled={loading}
          className="w-full sm:w-auto"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4 mr-2" />
          )}
          {loading ? 'Gerando...' : 'Baixar AVI (.docx)'}
        </Button>
      </CardContent>
    </Card>
  );
}
