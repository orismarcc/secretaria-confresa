import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileDown, FolderDown } from 'lucide-react';
import { DEMAND_CATEGORIES } from '@/components/forms/DemandTypeForm';
import {
  generateServicesReport,
  generateProducersReport,
  type ServicesReportStatus,
  type ServicesReportGroupBy,
} from '@/lib/reportsPdf';

interface ReportsCenterProps {
  services: any[];
  producers: any[];
  demandTypes: any[];
  settlements: any[];
}

type ReportKind = 'services' | 'producers';

/**
 * Central de Relatórios — ponto único para gerar qualquer PDF de
 * atendimentos e produtores, com filtros consolidados.
 * (AVI e ATER permanecem em Configurações.)
 */
export function ReportsCenter({ services, producers, demandTypes, settlements }: ReportsCenterProps) {
  const [kind, setKind] = useState<ReportKind>('services');
  const [status, setStatus] = useState<ServicesReportStatus>('all');
  const [groupBy, setGroupBy] = useState<ServicesReportGroupBy>('none');
  const [settlementId, setSettlementId] = useState('all');
  const [category, setCategory] = useState('all');

  const handleGenerate = () => {
    if (kind === 'services') {
      generateServicesReport({
        services, producers, demandTypes, settlements,
        status, groupBy, settlementId, category,
      });
    } else {
      generateProducersReport({
        producers, settlements,
        groupBy: groupBy === 'settlement' ? 'settlement' : 'none',
        settlementId,
      });
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-gradient-to-r from-primary/10 to-primary/5">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20"><FolderDown className="h-5 w-5 text-primary" /></div>
          <div>
            <span className="text-lg">Central de Relatórios</span>
            <p className="text-sm font-normal text-muted-foreground">
              Gere qualquer PDF de atendimentos e produtores em um só lugar
            </p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 items-end">
          {/* Tipo de relatório */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Relatório</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ReportKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="services">Atendimentos</SelectItem>
                <SelectItem value="producers">Produtores</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status — só p/ atendimentos */}
          {kind === 'services' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ServicesReportStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="completed">Finalizados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Agrupamento */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Agrupar por</Label>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as ServicesReportGroupBy)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem agrupamento</SelectItem>
                <SelectItem value="settlement">Assentamento</SelectItem>
                {kind === 'services' && <SelectItem value="category">Categoria</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {/* Assentamento */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Assentamento</Label>
            <Select value={settlementId} onValueChange={setSettlementId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(settlements as any[]).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Categoria — só p/ atendimentos */}
          {kind === 'services' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {DEMAND_CATEGORIES.filter(c => c.value !== 'entregas').map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Generate */}
          <div className={kind === 'services' ? 'col-span-2 lg:col-span-5' : 'col-span-2 lg:col-span-2'}>
            <Button onClick={handleGenerate} className="w-full sm:w-auto gap-2">
              <FileDown className="h-4 w-4" />
              Gerar PDF
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
