import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchInput } from '@/components/SearchInput';
import { CheckCircle2, ShieldCheck, Undo2, PauseCircle, PlayCircle, AlertTriangle, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { textIncludes } from '@/lib/text';
import { useSettlements } from '@/hooks/useSupabaseData';
import { useOfertas, useProdutos, useDocumentos, useSetSituacaoOferta, type Oferta } from './hooks';
import {
  SITUACOES_OFERTA, PROGRAMAS, statusInfo, unidadeLabel, programaLabel, mesesResumo, fmtNum, fmtBRL, situacaoOfertaInfo,
} from './constants';
import { MesesBar } from './Meses';
import { AceitarDialog } from './AceitarDialog';
import { avisosDoFornecedor } from './regras';

const ALL = '__all__';
const COLUNAS = ['disponivel', 'validada', 'aceita'] as const;

/**
 * Seleção: quadro de trabalho da equipe — Disponíveis → Validadas → Aceitas
 * (e Suspensas à parte). Cada cartão tem a ação do próximo passo.
 */
export function SelecaoTab({ onOpenFornecedor }: { onOpenFornecedor: (id: string) => void }) {
  const { data: ofertas = [] } = useOfertas();
  const { data: produtos = [] } = useProdutos();
  const { data: documentos = [] } = useDocumentos();
  const { data: settlements = [] } = useSettlements();
  const setSit = useSetSituacaoOferta();

  const [produtoId, setProdutoId] = useState(ALL);
  const [programa, setPrograma] = useState(ALL);
  const [assentamento, setAssentamento] = useState(ALL);
  const [busca, setBusca] = useState('');
  const [verSuspensas, setVerSuspensas] = useState(false);
  const [aceitar, setAceitar] = useState<Oferta | null>(null);

  const docsPorFornecedor = useMemo(() => {
    const m = new Map<string, typeof documentos>();
    documentos.forEach((d) => m.set(d.fornecedor_id, [...(m.get(d.fornecedor_id) || []), d]));
    return m;
  }, [documentos]);
  const avisos = (o: Oferta) => avisosDoFornecedor(o.vitrine_fornecedores?.status, docsPorFornecedor.get(o.fornecedor_id) || []);

  const filtradas = useMemo(() => ofertas.filter((o) => {
    if (!o.ativo || o.vitrine_fornecedores?.status === 'inativo') return false;
    if (produtoId !== ALL && o.produto_id !== produtoId) return false;
    if (programa !== ALL && o.situacao === 'aceita' && o.programa !== programa) return false;
    if (assentamento !== ALL && o.vitrine_fornecedores?.settlement_id !== assentamento) return false;
    if (busca && !(textIncludes(o.vitrine_produtos?.nome, busca) || textIncludes(o.vitrine_fornecedores?.nome, busca) || textIncludes(o.vitrine_variedades?.nome, busca))) return false;
    return true;
  }), [ofertas, produtoId, programa, assentamento, busca]);

  const porColuna = (s: string) => filtradas.filter((o) => o.situacao === s);
  const suspensas = porColuna('suspensa');

  // Resumo do produto filtrado: quanto está aceito, validado e só disponível (por unidade).
  const resumo = useMemo(() => {
    if (produtoId === ALL) return null;
    const r: Record<string, { aceita: number; validada: number; disponivel: number }> = {};
    filtradas.forEach((o) => {
      if (o.situacao === 'suspensa') return;
      const u = o.unidade;
      r[u] = r[u] || { aceita: 0, validada: 0, disponivel: 0 };
      if (o.situacao === 'aceita') r[u].aceita += Number(o.qtd_aceita ?? o.qtd_mensal) || 0;
      else if (o.situacao === 'validada') r[u].validada += Number(o.qtd_mensal) || 0;
      else r[u].disponivel += Number(o.qtd_mensal) || 0;
    });
    return r;
  }, [filtradas, produtoId]);

  const mover = (o: Oferta, situacao: string) => setSit.mutate({ id: o.id, situacao });

  const Cartao = ({ o }: { o: Oferta }) => {
    const av = avisos(o);
    const st = statusInfo(o.vitrine_fornecedores?.status);
    const un = unidadeLabel(o.unidade);
    return (
      <div className="rounded-lg border bg-background p-2.5 space-y-1.5 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm leading-tight">
            {o.vitrine_produtos?.nome}{o.vitrine_variedades?.nome ? <span className="font-normal"> — {o.vitrine_variedades.nome}</span> : null}
          </p>
          {av.length > 0 && (
            <span title={av.join('\n')} className="shrink-0 text-amber-600"><AlertTriangle className="h-4 w-4" /></span>
          )}
        </div>
        <button type="button" onClick={() => onOpenFornecedor(o.fornecedor_id)} className="text-left text-xs hover:underline">
          {o.vitrine_fornecedores?.nome} <Badge variant="outline" className={cn('ml-1 h-4 px-1 text-[9px]', st.cls)}>{st.label}</Badge>
        </button>
        <MesesBar meses={o.meses} />
        <p className="text-[11px] text-muted-foreground">
          {o.qtd_mensal != null ? `${fmtNum(o.qtd_mensal)} ${un}/mês` : 'qtd. não informada'} · {mesesResumo(o.meses)}
          {o.preco != null ? ` · ${fmtBRL(o.preco)}/${un}${o.preco_entregue ? ' entregue' : ''}` : ' · sem preço'}
        </p>
        {o.situacao === 'aceita' && (
          <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            {programaLabel(o.programa)} · {o.qtd_aceita != null ? `${fmtNum(o.qtd_aceita)} ${un}/mês aceito` : 'quantidade aceita não informada'}
          </p>
        )}
        <div className="flex flex-wrap gap-1 pt-0.5">
          {o.situacao === 'disponivel' && (
            <>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => mover(o, 'validada')}><ShieldCheck className="h-3.5 w-3.5 mr-1" />Validar</Button>
              <Button size="sm" className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-600/90 text-white" onClick={() => setAceitar(o)}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Aceitar</Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => mover(o, 'suspensa')} title="Suspender"><PauseCircle className="h-3.5 w-3.5" /></Button>
            </>
          )}
          {o.situacao === 'validada' && (
            <>
              <Button size="sm" className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-600/90 text-white" onClick={() => setAceitar(o)}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Aceitar</Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => mover(o, 'disponivel')} title="Voltar para disponível"><Undo2 className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => mover(o, 'suspensa')} title="Suspender"><PauseCircle className="h-3.5 w-3.5" /></Button>
            </>
          )}
          {o.situacao === 'aceita' && (
            <>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setAceitar(o)}><Pencil className="h-3.5 w-3.5 mr-1" />Aceite</Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => mover(o, 'validada')} title="Voltar para validada"><Undo2 className="h-3.5 w-3.5" /></Button>
            </>
          )}
          {o.situacao === 'suspensa' && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => mover(o, 'disponivel')}><PlayCircle className="h-3.5 w-3.5 mr-1" />Reativar</Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Select value={produtoId} onValueChange={setProdutoId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os produtos</SelectItem>
            {produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={programa} onValueChange={setPrograma}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Aceitas: todos os programas</SelectItem>
            {PROGRAMAS.map((p) => <SelectItem key={p.value} value={p.value}>Aceitas: {p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assentamento} onValueChange={setAssentamento}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os assentamentos</SelectItem>
            {(settlements as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar produto ou fornecedor…" />
      </div>

      {resumo && Object.keys(resumo).length > 0 && (
        <div className="rounded-lg border bg-primary/5 border-primary/20 p-3 text-sm space-y-1">
          {Object.entries(resumo).map(([u, r]) => (
            <p key={u} className="flex flex-wrap gap-x-4">
              <span><span className="font-bold text-emerald-700 dark:text-emerald-400">{fmtNum(r.aceita)}</span> {unidadeLabel(u)}/mês aceito</span>
              <span><span className="font-semibold text-blue-700 dark:text-blue-400">{fmtNum(r.validada)}</span> validado (a aceitar)</span>
              <span><span className="font-semibold">{fmtNum(r.disponivel)}</span> só disponível (a conferir)</span>
            </p>
          ))}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {COLUNAS.map((c) => {
          const info = situacaoOfertaInfo(c);
          const itens = porColuna(c);
          return (
            <div key={c} className="rounded-lg border bg-muted/30 p-2 space-y-2 min-h-[120px]">
              <div className="flex items-center gap-2 px-1">
                <span className={cn('h-2.5 w-2.5 rounded-full', info.dot)} />
                <p className="text-sm font-semibold">{info.label}</p>
                <span className="text-xs text-muted-foreground">{itens.length}</span>
              </div>
              <p className="px-1 text-[11px] text-muted-foreground -mt-1">{info.desc}</p>
              {itens.length === 0
                ? <p className="px-1 py-4 text-center text-xs text-muted-foreground">Nenhuma oferta.</p>
                : itens.map((o) => <Cartao key={o.id} o={o} />)}
            </div>
          );
        })}
      </div>

      {suspensas.length > 0 && (
        <div className="rounded-lg border border-dashed p-2">
          <button type="button" className="text-sm text-muted-foreground hover:underline" onClick={() => setVerSuspensas((v) => !v)}>
            {verSuspensas ? 'Ocultar' : 'Ver'} suspensas ({suspensas.length})
          </button>
          {verSuspensas && <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{suspensas.map((o) => <Cartao key={o.id} o={o} />)}</div>}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        {SITUACOES_OFERTA.filter((s) => s.value !== 'suspensa').map((s) => `${s.label}: ${s.desc.toLowerCase()}`).join(' · ')}.
        O ícone <AlertTriangle className="inline h-3 w-3 text-amber-600" /> indica fornecedor não validado ou com documento vencido.
      </p>

      <AceitarDialog oferta={aceitar} onOpenChange={(o) => { if (!o) setAceitar(null); }} avisos={aceitar ? avisos(aceitar) : []} />
    </div>
  );
}
