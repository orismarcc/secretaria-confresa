import { useMemo, useState } from 'react';
import { AlertTriangle, ShieldCheck, FileWarning, Clock, Tag, TrendingUp, CalendarClock, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { statusVencimento, vencLabel } from '@/lib/vencimento';
import type { Fornecedor, Oferta, Documento } from './hooks';
import { MESES, tipoDocLabel, unidadeLabel, fmtNum, statusInfo, programaLabel } from './constants';

const DIA = 24 * 60 * 60 * 1000;
const PRECO_VELHO_DIAS = 180;
const CADASTRO_VELHO_DIAS = 365;
const parse = (v?: string | null) => (v ? new Date(String(v).replace(' ', 'T')).getTime() : NaN);

interface Item { id: string; fornecedorId: string; titulo: string; detalhe: string }
interface Grupo { key: string; label: string; icon: React.ElementType; tom: string; itens: Item[] }

export function AlertasPanel({ fornecedores, ofertas, documentos, onOpenFornecedor }: {
  fornecedores: Fornecedor[]; ofertas: Oferta[]; documentos: Documento[]; onOpenFornecedor: (id: string) => void;
}) {
  const [aberto, setAberto] = useState<string | null>(null);

  const grupos = useMemo<Grupo[]>(() => {
    const agora = Date.now();
    const ativosF = new Map(fornecedores.filter((f) => f.status !== 'inativo').map((f) => [f.id, f]));
    const ofertasAtivas = ofertas.filter((o) => o.ativo && ativosF.has(o.fornecedor_id));
    const nomeF = (id: string) => ativosF.get(id)?.nome || fornecedores.find((f) => f.id === id)?.nome || '';
    const prod = (o: Oferta) => `${o.vitrine_produtos?.nome || ''}${o.vitrine_variedades?.nome ? ` ${o.vitrine_variedades.nome}` : ''}`;

    const docs: Item[] = documentos
      .filter((d) => d.validade && statusVencimento(d.validade).status !== 'ok')
      .sort((a, b) => (a.validade || '').localeCompare(b.validade || ''))
      .map((d) => ({
        id: d.id, fornecedorId: d.fornecedor_id, titulo: `${d.vitrine_fornecedores?.nome || ''} · ${tipoDocLabel(d.tipo)}`,
        detalhe: `${format(new Date(`${d.validade}T12:00:00`), 'dd/MM/yyyy')} — ${vencLabel(d.validade!)}`,
      }));

    const ultimaAtualizacao = new Map<string, number>();
    ativosF.forEach((f) => ultimaAtualizacao.set(f.id, parse(f.updated_at)));
    ofertas.forEach((o) => {
      const t = parse(o.updated_at);
      if (Number.isFinite(t) && t > (ultimaAtualizacao.get(o.fornecedor_id) ?? -Infinity)) ultimaAtualizacao.set(o.fornecedor_id, t);
    });
    const velhos: Item[] = [...ativosF.values()]
      .filter((f) => { const t = ultimaAtualizacao.get(f.id); return Number.isFinite(t) && agora - (t as number) > CADASTRO_VELHO_DIAS * DIA; })
      .map((f) => ({
        id: f.id, fornecedorId: f.id, titulo: f.nome,
        detalhe: `última atualização em ${format(new Date(ultimaAtualizacao.get(f.id)!), 'dd/MM/yyyy')}`,
      }));

    const semPreco: Item[] = ofertasAtivas.filter((o) => o.preco == null).map((o) => ({
      id: o.id, fornecedorId: o.fornecedor_id, titulo: `${nomeF(o.fornecedor_id)} · ${prod(o)}`, detalhe: 'oferta sem preço informado',
    }));

    const precoVelho: Item[] = ofertasAtivas
      .filter((o) => o.preco != null && Number.isFinite(parse(o.preco_atualizado_em)) && agora - parse(o.preco_atualizado_em) > PRECO_VELHO_DIAS * DIA)
      .map((o) => ({
        id: o.id, fornecedorId: o.fornecedor_id, titulo: `${nomeF(o.fornecedor_id)} · ${prod(o)}`,
        detalhe: `preço de ${format(new Date(parse(o.preco_atualizado_em)), 'dd/MM/yyyy')}`,
      }));

    const mesAtual = new Date().getMonth() + 1;
    const proximo = mesAtual === 12 ? 1 : mesAtual + 1;
    const safra: Item[] = ofertasAtivas
      .filter((o) => (o.meses || []).includes(proximo) && !(o.meses || []).includes(mesAtual))
      .map((o) => ({
        id: o.id, fornecedorId: o.fornecedor_id, titulo: `${prod(o)} · ${nomeF(o.fornecedor_id)}`,
        detalhe: `disponível a partir de ${MESES[proximo - 1]}${o.qtd_mensal != null ? ` · ${fmtNum(o.qtd_mensal)} ${unidadeLabel(o.unidade)}/mês` : ''}`,
      }));

    // Ofertas ACEITAS cujo fornecedor não está apto: risco direto na distribuição.
    const docVencidoPorF = new Set(documentos
      .filter((d) => d.validade && statusVencimento(d.validade).status === 'vencido')
      .map((d) => d.fornecedor_id));
    const aceitas = ofertas.filter((o) => o.ativo && o.situacao === 'aceita');
    const aceitaRisco: Item[] = aceitas
      .filter((o) => o.vitrine_fornecedores?.status !== 'validado' || docVencidoPorF.has(o.fornecedor_id))
      .map((o) => ({
        id: o.id, fornecedorId: o.fornecedor_id, titulo: `${prod(o)} · ${nomeF(o.fornecedor_id)}`,
        detalhe: [
          o.programa ? programaLabel(o.programa) : null,
          o.vitrine_fornecedores?.status !== 'validado' ? `fornecedor ${statusInfo(o.vitrine_fornecedores?.status).label.toLowerCase()}` : null,
          docVencidoPorF.has(o.fornecedor_id) ? 'documento vencido' : null,
        ].filter(Boolean).join(' · '),
      }));

    return [
      { key: 'aceitarisco', label: 'Oferta aceita com fornecedor não apto', icon: ShieldAlert, tom: 'red', itens: aceitaRisco },
      { key: 'docs', label: 'Documentos vencidos/vencendo', icon: FileWarning, tom: 'red', itens: docs },
      { key: 'velhos', label: 'Cadastro sem atualização há 12 meses', icon: Clock, tom: 'amber', itens: velhos },
      { key: 'sempreco', label: 'Ofertas sem preço', icon: Tag, tom: 'amber', itens: semPreco },
      { key: 'precovelho', label: `Preço com mais de ${PRECO_VELHO_DIAS / 30} meses`, icon: TrendingUp, tom: 'amber', itens: precoVelho },
      { key: 'safra', label: 'Entra em safra no próximo mês', icon: CalendarClock, tom: 'blue', itens: safra },
    ];
  }, [fornecedores, ofertas, documentos]);

  const pendencias = grupos.filter((g) => g.tom !== 'blue').reduce((s, g) => s + g.itens.length, 0);
  const TOM: Record<string, string> = {
    red: 'border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400',
    amber: 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400',
    blue: 'border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-400',
  };
  const grupoAberto = grupos.find((g) => g.key === aberto);

  if (fornecedores.length === 0) return null;

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <p className="text-sm font-semibold flex items-center gap-2">
        {pendencias > 0 ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <ShieldCheck className="h-4 w-4 text-emerald-600" />}
        {pendencias > 0 ? `Alertas (${pendencias} pendência(s))` : 'Sem pendências — cadastros, preços e documentos em dia'}
      </p>
      <div className="flex flex-wrap gap-2">
        {grupos.filter((g) => g.itens.length > 0).map((g) => {
          const Icon = g.icon;
          return (
            <button key={g.key} type="button" onClick={() => setAberto(aberto === g.key ? null : g.key)}
              className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium', TOM[g.tom], aberto === g.key && 'ring-2 ring-offset-1 ring-current')}>
              <Icon className="h-3.5 w-3.5" /> {g.label} <span className="font-bold">{g.itens.length}</span>
            </button>
          );
        })}
      </div>
      {grupoAberto && (
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {grupoAberto.itens.slice(0, 30).map((it) => (
            <button key={it.id} type="button" onClick={() => onOpenFornecedor(it.fornecedorId)}
              className={cn('rounded-md border p-2 text-left', TOM[grupoAberto.tom])}>
              <p className="text-sm font-semibold truncate">{it.titulo}</p>
              <p className="text-[11px] opacity-90 truncate">{it.detalhe}</p>
            </button>
          ))}
          {grupoAberto.itens.length > 30 && <p className="text-xs text-muted-foreground">+ {grupoAberto.itens.length - 30} outro(s)</p>}
        </div>
      )}
    </div>
  );
}
