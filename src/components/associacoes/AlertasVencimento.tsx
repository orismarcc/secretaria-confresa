// Alertas de vencimento dos documentos das associações (vencidos e
// vencendo em até 30 dias). Mesmo visual dos alertas da frota.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, FileWarning, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { vencClasses } from '@/lib/vencimento';
import {
  useAssociacoes, useDispensas, useDocumentosAssociacoes, useItensChecklist,
} from '@/hooks/useAssociacoes';
import { alertasVencimento, DIAS_PROXIMO } from '@/lib/associacoes';
import { dataBR } from './comum';

/**
 * `ocultarSeVazio`: no Dashboard não mostra nada quando está tudo em dia;
 * na página Associações mostra a faixa verde de "tudo em dia".
 */
export function AlertasVencimentoAssociacoes({ ocultarSeVazio = false, limite = 8 }: { ocultarSeVazio?: boolean; limite?: number }) {
  const navigate = useNavigate();
  const { data: associacoes = [] } = useAssociacoes();
  const { data: itens = [] } = useItensChecklist();
  const { data: docs = [] } = useDocumentosAssociacoes();
  const { data: dispensas = [] } = useDispensas();
  const alertas = useMemo(() => alertasVencimento(associacoes, itens, docs, dispensas), [associacoes, itens, docs, dispensas]);

  if (!associacoes.length) return null;
  if (!alertas.length) {
    if (ocultarSeVazio) return null;
    return (
      <div className="rounded-lg border bg-emerald-500/5 border-emerald-500/25 p-3 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        Nenhum documento vencido ou vencendo nos próximos {DIAS_PROXIMO} dias.
      </div>
    );
  }
  const vencidos = alertas.filter((a) => a.status === 'vencido').length;
  const abrir = (id: string) => navigate(`/associacoes/${id}?aba=regularizacao`);

  return (
    <div className="rounded-lg border p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm font-semibold">
          Documentos de associações
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {alertas.length} alerta(s){vencidos > 0 ? ` · ${vencidos} vencido(s)` : ''}
          </span>
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {alertas.slice(0, limite).map((a) => (
          <button key={a.chave} type="button" onClick={() => abrir(a.associacao.id)}
            className={cn('rounded-lg p-2.5 flex items-start gap-2 text-left transition-opacity hover:opacity-90', vencClasses(a.status === 'vencido' ? 'vencido' : 'proximo'))}>
            <FileWarning className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{a.titulo}</p>
              <p className="text-[11px] opacity-80 truncate">{a.associacao.sigla || a.associacao.nome}</p>
              <p className="text-[11px] font-medium mt-0.5">
                {dataBR(a.validade)} — {a.status === 'vencido'
                  ? `vencido há ${Math.abs(a.dias)} dia(s)`
                  : a.dias === 0 ? 'vence hoje' : `vence em ${a.dias} dia(s)`}
              </p>
            </div>
          </button>
        ))}
      </div>
      {alertas.length > limite && (
        <button type="button" onClick={() => navigate('/associacoes')} className="text-xs text-primary underline">
          Ver todos os {alertas.length} alertas
        </button>
      )}
    </div>
  );
}
