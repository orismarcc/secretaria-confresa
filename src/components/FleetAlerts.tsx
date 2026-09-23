import { useMemo } from 'react';
import { AlertTriangle, ShieldCheck, FileWarning, IdCard } from 'lucide-react';
import { useFleetDocumentsWithValidade, useDriverLicensesWithValidade } from '@/hooks/useSupabaseData';
import { useOperators } from '@/hooks/useOperatorData';
import { statusVencimento, vencClasses, vencLabel, fleetDocLabel } from '@/lib/vencimento';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Painel de vencimentos: mostra documentos da frota e CNHs próximos do
// vencimento ou vencidos, com cores (vermelho = vencido, amarelo = próximo).
export function FleetAlerts() {
  const { data: docs = [] } = useFleetDocumentsWithValidade();
  const { data: cnhs = [] } = useDriverLicensesWithValidade();
  const { data: operators = [] } = useOperators();

  const opName = useMemo(() => {
    const m = new Map<string, string>((operators as any[]).map((o) => [o.id, o.name]));
    return (id: string) => m.get(id) || 'Operador';
  }, [operators]);

  const alertas = useMemo(() => {
    type Item = { key: string; titulo: string; sub: string; validade: string; order: number };
    const items: Item[] = [];
    (docs as any[]).forEach((d) => {
      const st = statusVencimento(d.validade);
      if (st.status === 'ok') return;
      items.push({
        key: `doc-${d.id}`,
        titulo: `${d.machinery?.name || 'Item'} · ${fleetDocLabel(d.doc_type)}`,
        sub: `${d.machinery?.kind === 'veiculo' ? 'Veículo' : 'Maquinário'}${d.machinery?.patrimony_number ? ` · Pat. ${d.machinery.patrimony_number}` : ''}`,
        validade: d.validade, order: st.dias ?? 0,
      });
    });
    (cnhs as any[]).forEach((c) => {
      const st = statusVencimento(c.validade);
      if (st.status === 'ok') return;
      items.push({
        key: `cnh-${c.operator_id}`,
        titulo: `CNH · ${opName(c.operator_id)}`,
        sub: `Habilitação${c.categoria ? ` · Cat. ${c.categoria}` : ''}`,
        validade: c.validade, order: st.dias ?? 0,
      });
    });
    return items.sort((a, b) => a.order - b.order);
  }, [docs, cnhs, opName]);

  const vencidos = alertas.filter((a) => statusVencimento(a.validade).status === 'vencido').length;

  if (alertas.length === 0) {
    return (
      <div className="rounded-lg border bg-emerald-500/5 border-emerald-500/25 p-3 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        Nenhum vencimento próximo. Documentação e CNHs em dia.
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm font-semibold">
          Alertas de vencimento
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {alertas.length} item(ns){vencidos > 0 ? ` · ${vencidos} vencido(s)` : ''}
          </span>
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {alertas.map((a) => {
          const st = statusVencimento(a.validade);
          const isCnh = a.key.startsWith('cnh-');
          return (
            <div key={a.key} className={cn('rounded-lg p-2.5 flex items-start gap-2', vencClasses(st.status))}>
              {isCnh ? <IdCard className="h-4 w-4 shrink-0 mt-0.5" /> : <FileWarning className="h-4 w-4 shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{a.titulo}</p>
                <p className="text-[11px] opacity-80 truncate">{a.sub}</p>
                <p className="text-[11px] font-medium mt-0.5">
                  {format(new Date(a.validade.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })} — {vencLabel(a.validade)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
