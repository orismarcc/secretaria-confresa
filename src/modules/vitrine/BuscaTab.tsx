import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchInput } from '@/components/SearchInput';
import { DataTable } from '@/components/DataTable';
import { FileDown, FileSpreadsheet, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { textIncludes } from '@/lib/text';
import { cn } from '@/lib/utils';
import { useProducers, useSettlements } from '@/hooks/useSupabaseData';
import { useOfertas, useProdutos, useVariedades, useFornecedores, type Oferta } from './hooks';
import {
  MESES, FREQUENCIAS, SITUACOES_OFERTA, statusInfo, unidadeLabel, frequenciaLabel, mesesResumo, fmtNum, fmtBRL,
  situacaoOfertaInfo, programaLabel,
} from './constants';
import { MesesBar } from './Meses';
import { SEDE, coordsDoFornecedor, distanciaKm, fmtKm } from './geo';
import { exportarOfertasPdf, exportarOfertasXlsx, type LinhaOferta } from './exportar';

const ALL = '__all__';
const FREQ_RANK: Record<string, number> = { semanal: 1, quinzenal: 2, mensal: 3, sob_demanda: 4 };
const toNum = (s: string) => { const n = Number(String(s).replace(',', '.')); return s.trim() === '' || !Number.isFinite(n) ? null : n; };

/** Meses de ini a fim, atravessando a virada do ano se preciso (ex.: 11→2 = Nov..Fev). */
function mesesDoPeriodo(ini: number, fim: number): number[] {
  const out: number[] = [];
  let m = ini;
  for (let i = 0; i < 12; i++) { out.push(m); if (m === fim) break; m = m === 12 ? 1 : m + 1; }
  return out;
}

export interface BuscaPreset { produtoId?: string; mes?: number; n: number }

const inicial = {
  busca: '', produtoId: ALL, variedadeId: ALL, mesIni: ALL, mesFim: ALL, modoPeriodo: 'todos' as 'todos' | 'algum',
  assentamento: ALL, qtdMin: '', precoMax: '', freqMin: ALL, soValidados: false, soAtivas: true,
  comEntrega: false, entregaPropria: false, emiteNota: false, ordem: 'recentes',
  situacao: '__sem_suspensas__',
};

export function BuscaTab({ onOpenFornecedor, preset }: { onOpenFornecedor: (id: string) => void; preset?: BuscaPreset | null }) {
  const { data: ofertas = [], isLoading } = useOfertas();
  const { data: produtos = [] } = useProdutos();
  const { data: variedades = [] } = useVariedades();
  const { data: fornecedores = [] } = useFornecedores();
  const { data: producers = [] } = useProducers();
  const { data: settlements = [] } = useSettlements();

  const [f, setF] = useState(inicial);
  const [avancado, setAvancado] = useState(false);
  const set = <K extends keyof typeof inicial>(k: K, v: (typeof inicial)[K]) => setF((s) => ({ ...s, [k]: v }));

  // Vindo do Calendário: aplica produto e mês.
  useEffect(() => {
    if (!preset) return;
    setF({
      ...inicial,
      produtoId: preset.produtoId ?? ALL,
      mesIni: preset.mes ? String(preset.mes) : ALL,
      mesFim: preset.mes ? String(preset.mes) : ALL,
    });
  }, [preset]);

  // Distância da sede por fornecedor (linha reta).
  const distPorFornecedor = useMemo(() => {
    const pById = new Map((producers as any[]).map((p) => [p.id, p]));
    const m = new Map<string, number>();
    fornecedores.forEach((fo) => {
      const c = coordsDoFornecedor(fo, pById);
      if (c) m.set(fo.id, distanciaKm(SEDE.lat, SEDE.lng, c.lat, c.lng));
    });
    return m;
  }, [fornecedores, producers]);

  const varsDoProduto = variedades.filter((v) => v.produto_id === f.produtoId);
  const periodo = f.mesIni !== ALL
    ? mesesDoPeriodo(Number(f.mesIni), f.mesFim !== ALL ? Number(f.mesFim) : Number(f.mesIni))
    : null;

  const filtradas = useMemo(() => {
    const qtdMin = toNum(f.qtdMin);
    const precoMax = toNum(f.precoMax);
    const list = ofertas.filter((o) => {
      const st = o.vitrine_fornecedores?.status;
      if (f.soAtivas && (!o.ativo || st === 'inativo')) return false;
      if (f.soValidados && st !== 'validado') return false;
      if (f.situacao === '__sem_suspensas__' ? o.situacao === 'suspensa' : (f.situacao !== ALL && o.situacao !== f.situacao)) return false;
      if (f.produtoId !== ALL && o.produto_id !== f.produtoId) return false;
      if (f.variedadeId !== ALL && o.variedade_id !== f.variedadeId) return false;
      if (periodo) {
        const ms = new Set(o.meses || []);
        const ok = f.modoPeriodo === 'todos' ? periodo.every((m) => ms.has(m)) : periodo.some((m) => ms.has(m));
        if (!ok) return false;
      }
      if (f.assentamento !== ALL && o.vitrine_fornecedores?.settlement_id !== f.assentamento) return false;
      if (qtdMin != null && (o.qtd_mensal == null || Number(o.qtd_mensal) < qtdMin)) return false;
      if (precoMax != null && (o.preco == null || Number(o.preco) > precoMax)) return false;
      if (f.freqMin !== ALL && (!o.frequencia || FREQ_RANK[o.frequencia] > FREQ_RANK[f.freqMin])) return false;
      if (f.comEntrega && !o.preco_entregue) return false;
      if (f.entregaPropria && o.entrega_propria !== true) return false;
      if (f.emiteNota && o.emite_nota !== true) return false;
      if (f.busca && !(
        textIncludes(o.vitrine_produtos?.nome, f.busca) ||
        textIncludes(o.vitrine_variedades?.nome, f.busca) ||
        textIncludes(o.vitrine_fornecedores?.nome, f.busca)
      )) return false;
      return true;
    });
    const dist = (o: Oferta) => distPorFornecedor.get(o.fornecedor_id) ?? Infinity;
    if (f.ordem === 'preco') list.sort((a, b) => (a.preco ?? Infinity) - (b.preco ?? Infinity));
    else if (f.ordem === 'qtd') list.sort((a, b) => (Number(b.qtd_mensal) || 0) - (Number(a.qtd_mensal) || 0));
    else if (f.ordem === 'distancia') list.sort((a, b) => dist(a) - dist(b));
    return list;
  }, [ofertas, f, periodo, distPorFornecedor]);

  const nFornecedores = new Set(filtradas.map((o) => o.fornecedor_id)).size;
  const totais = useMemo(() => {
    if (f.produtoId === ALL) return null;
    const t: Record<string, number> = {};
    filtradas.forEach((o) => { t[o.unidade] = (t[o.unidade] || 0) + (Number(o.qtd_mensal) || 0); });
    return t;
  }, [filtradas, f.produtoId]);

  const nomeProduto = produtos.find((p) => p.id === f.produtoId)?.nome;
  const descricaoFiltros = [
    nomeProduto ? `Produto: ${nomeProduto}${f.variedadeId !== ALL ? ` (${variedades.find((v) => v.id === f.variedadeId)?.nome})` : ''}` : 'Todos os produtos',
    periodo ? `Período: ${MESES[periodo[0] - 1]}–${MESES[periodo[periodo.length - 1] - 1]} (${f.modoPeriodo === 'todos' ? 'todos os meses' : 'algum mês'})` : null,
    f.assentamento !== ALL ? `Assentamento: ${(settlements as any[]).find((s) => s.id === f.assentamento)?.name}` : null,
    toNum(f.qtdMin) != null ? `Qtd mín.: ${f.qtdMin}/mês` : null,
    toNum(f.precoMax) != null ? `Preço máx.: R$ ${f.precoMax}` : null,
    f.freqMin !== ALL ? `Entrega: ${frequenciaLabel(f.freqMin).toLowerCase()} ou melhor` : null,
    f.comEntrega ? 'Preço com entrega' : null,
    f.entregaPropria ? 'Transporte próprio' : null,
    f.emiteNota ? 'Emite nota' : null,
    f.soValidados ? 'Só validados' : null,
    f.situacao !== ALL && f.situacao !== '__sem_suspensas__' ? `Ofertas: ${situacaoOfertaInfo(f.situacao).label.toLowerCase()}s` : null,
  ].filter(Boolean).join(' · ');

  const linhas = (): LinhaOferta[] => filtradas.map((o) => ({
    fornecedor: o.vitrine_fornecedores?.nome || '',
    situacao: statusInfo(o.vitrine_fornecedores?.status).label,
    assentamento: o.vitrine_fornecedores?.settlements?.name || '',
    produto: o.vitrine_produtos?.nome || '',
    variedade: o.vitrine_variedades?.nome || '',
    qtd: o.qtd_mensal != null ? Number(o.qtd_mensal) : null,
    unidade: unidadeLabel(o.unidade),
    periodo: mesesResumo(o.meses),
    preco: o.preco != null ? Number(o.preco) : null,
    entregue: o.preco_entregue,
    frequencia: o.frequencia ? frequenciaLabel(o.frequencia) : '',
    entregaPropria: o.entrega_propria == null ? '' : o.entrega_propria ? 'Transporte próprio' : 'Sem transporte',
    emiteNota: o.emite_nota == null ? '' : o.emite_nota ? 'Sim' : 'Não',
    distanciaKm: distPorFornecedor.get(o.fornecedor_id) ?? null,
    situacaoOferta: situacaoOfertaInfo(o.situacao).label + (o.situacao === 'aceita' && o.programa ? ` (${programaLabel(o.programa)})` : ''),
  }));
  const resumoTexto = `${filtradas.length} oferta(s) de ${nFornecedores} fornecedor(es)` +
    (totais ? ' · Total: ' + Object.entries(totais).map(([u, q]) => `${fmtNum(q)} ${unidadeLabel(u)}/mês`).join(' + ') : '');

  const columns = [
    {
      key: 'fornecedor', header: 'Fornecedor', render: (o: Oferta) => {
        const st = statusInfo(o.vitrine_fornecedores?.status);
        const km = distPorFornecedor.get(o.fornecedor_id);
        return (
          <div className="min-w-0">
            <p className="font-medium truncate">{o.vitrine_fornecedores?.nome}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-muted-foreground truncate">{o.vitrine_fornecedores?.settlements?.name || '—'}</span>
              {km != null && <span className="text-[11px] text-muted-foreground">· {fmtKm(km)}</span>}
              <Badge variant="outline" className={cn('h-4 px-1.5 text-[10px]', st.cls)}>{st.label}</Badge>
            </div>
          </div>
        );
      },
    },
    {
      key: 'produto', header: 'Produto', render: (o: Oferta) => (
        <div><p className="font-medium">{o.vitrine_produtos?.nome}</p>
          {o.vitrine_variedades?.nome && <p className="text-[11px] text-muted-foreground">{o.vitrine_variedades.nome}</p>}
          <Badge variant="outline" className={cn('mt-0.5 h-4 px-1.5 text-[10px]', situacaoOfertaInfo(o.situacao).cls)}>
            {situacaoOfertaInfo(o.situacao).label}{o.situacao === 'aceita' && o.programa ? ` · ${programaLabel(o.programa)}` : ''}
          </Badge></div>
      ),
    },
    { key: 'qtd', header: 'Qtd/mês', render: (o: Oferta) => o.qtd_mensal != null ? `${fmtNum(o.qtd_mensal)} ${unidadeLabel(o.unidade)}` : <span className="text-muted-foreground">—</span> },
    {
      key: 'meses', header: 'Período', className: 'hidden md:table-cell', render: (o: Oferta) => (
        <div className="space-y-1"><MesesBar meses={o.meses} /><p className="text-[11px] text-muted-foreground">{mesesResumo(o.meses)}</p></div>
      ),
    },
    {
      key: 'preco', header: 'Preço', render: (o: Oferta) => o.preco != null ? (
        <div><p className="font-medium">{fmtBRL(o.preco)}<span className="text-[11px] text-muted-foreground">/{unidadeLabel(o.unidade)}</span></p>
          <p className="text-[11px] text-muted-foreground">{o.preco_entregue ? 'com entrega' : 'na propriedade'}</p></div>
      ) : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'entrega', header: 'Entrega', className: 'hidden lg:table-cell', render: (o: Oferta) => (
        <span className="text-sm">{o.frequencia ? frequenciaLabel(o.frequencia) : '—'}{o.entrega_propria ? ' · própria' : ''}{o.emite_nota ? ' · nota' : ''}</span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {/* Filtros principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Select value={f.produtoId} onValueChange={(v) => setF((s) => ({ ...s, produtoId: v, variedadeId: ALL }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os produtos</SelectItem>
            {produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={f.variedadeId} onValueChange={(v) => set('variedadeId', v)} disabled={f.produtoId === ALL || varsDoProduto.length === 0}>
          <SelectTrigger><SelectValue placeholder="Variedade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as variedades</SelectItem>
            {varsDoProduto.map((v) => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={f.assentamento} onValueChange={(v) => set('assentamento', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os assentamentos</SelectItem>
            {(settlements as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <SearchInput value={f.busca} onChange={(v) => set('busca', v)} placeholder="Buscar produto ou fornecedor…" />
      </div>

      {/* Período */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Disponível de</span>
        <Select value={f.mesIni} onValueChange={(v) => setF((s) => ({ ...s, mesIni: v, mesFim: v === ALL ? ALL : (s.mesFim === ALL ? v : s.mesFim) }))}>
          <SelectTrigger className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>qualquer mês</SelectItem>
            {MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">até</span>
        <Select value={f.mesFim} onValueChange={(v) => set('mesFim', v)} disabled={f.mesIni === ALL}>
          <SelectTrigger className="h-9 w-[90px]"><SelectValue /></SelectTrigger>
          <SelectContent>{MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={f.modoPeriodo} onValueChange={(v) => set('modoPeriodo', v as 'todos' | 'algum')} disabled={f.mesIni === ALL}>
          <SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">em todos os meses</SelectItem>
            <SelectItem value="algum">em pelo menos um mês</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAvancado((a) => !a)} className="gap-1">
          <SlidersHorizontal className="h-4 w-4" /> Mais filtros
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setF(inicial)} className="gap-1 text-muted-foreground">
          <RotateCcw className="h-4 w-4" /> Limpar
        </Button>
      </div>

      {avancado && (
        <div className="rounded-lg border p-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1"><Label className="text-xs">Quantidade mínima/mês</Label><Input inputMode="decimal" value={f.qtdMin} onChange={(e) => set('qtdMin', e.target.value)} placeholder="Ex.: 500" /></div>
          <div className="space-y-1"><Label className="text-xs">Preço máximo (R$)</Label><Input inputMode="decimal" value={f.precoMax} onChange={(e) => set('precoMax', e.target.value)} placeholder="Ex.: 4,00" /></div>
          <div className="space-y-1">
            <Label className="text-xs">Entrega pelo menos</Label>
            <Select value={f.freqMin} onValueChange={(v) => set('freqMin', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Qualquer frequência</SelectItem>
                {FREQUENCIAS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ordenar por</Label>
            <Select value={f.ordem} onValueChange={(v) => set('ordem', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recentes">Mais recentes</SelectItem>
                <SelectItem value="preco">Menor preço</SelectItem>
                <SelectItem value="qtd">Maior quantidade</SelectItem>
                <SelectItem value="distancia">Mais perto da sede</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-x-5 gap-y-2">
            <label className="flex items-center gap-2 text-sm"><Switch checked={f.comEntrega} onCheckedChange={(c) => set('comEntrega', c)} /> Preço com entrega</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={f.entregaPropria} onCheckedChange={(c) => set('entregaPropria', c)} /> Transporte próprio</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={f.emiteNota} onCheckedChange={(c) => set('emiteNota', c)} /> Emite nota</label>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Select value={f.situacao} onValueChange={(v) => set('situacao', v)}>
          <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__sem_suspensas__">Ofertas: todas (sem suspensas)</SelectItem>
            {SITUACOES_OFERTA.map((s) => <SelectItem key={s.value} value={s.value}>Ofertas: {s.label.toLowerCase()}s</SelectItem>)}
            <SelectItem value={ALL}>Ofertas: todas, inclusive suspensas</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.soValidados} onCheckedChange={(c) => set('soValidados', c)} /> Só fornecedores validados</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.soAtivas} onCheckedChange={(c) => set('soAtivas', c)} /> Só ofertas ativas</label>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" disabled={filtradas.length === 0} onClick={() => exportarOfertasPdf(linhas(), descricaoFiltros, resumoTexto)}>
            <FileDown className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" disabled={filtradas.length === 0} onClick={() => exportarOfertasXlsx(linhas())}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Planilha
          </Button>
        </div>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-3 text-sm flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p><span className="text-xl font-bold">{filtradas.length}</span> oferta(s) de <span className="font-semibold">{nFornecedores}</span> fornecedor(es)</p>
          {totais && Object.entries(totais).map(([u, q]) => (
            <p key={u}>Total: <span className="text-xl font-bold">{fmtNum(q)}</span> {unidadeLabel(u)}/mês</p>
          ))}
        </CardContent>
      </Card>

      <DataTable
        data={filtradas}
        columns={columns}
        keyExtractor={(o) => o.id}
        onRowClick={(o) => onOpenFornecedor(o.fornecedor_id)}
        isLoading={isLoading}
        emptyMessage="Nenhuma oferta encontrada com esses filtros."
      />
    </div>
  );
}
