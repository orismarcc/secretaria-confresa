import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchInput } from '@/components/SearchInput';
import { DataTable } from '@/components/DataTable';
import { textIncludes } from '@/lib/text';
import { cn } from '@/lib/utils';
import { useSettlements } from '@/hooks/useSupabaseData';
import { useOfertas, useProdutos, type Oferta } from './hooks';
import { MESES, statusInfo, unidadeLabel, frequenciaLabel, mesesResumo, fmtNum, fmtBRL } from './constants';
import { MesesBar } from './Meses';

const ALL = '__all__';

export function OfertasTab({ onOpenFornecedor }: { onOpenFornecedor: (fornecedorId: string) => void }) {
  const { data: ofertas = [], isLoading } = useOfertas();
  const { data: produtos = [] } = useProdutos();
  const { data: settlements = [] } = useSettlements();

  const [busca, setBusca] = useState('');
  const [produtoId, setProdutoId] = useState(ALL);
  const [mes, setMes] = useState(ALL);
  const [assentamento, setAssentamento] = useState(ALL);
  const [soValidados, setSoValidados] = useState(false);
  const [soAtivas, setSoAtivas] = useState(true);

  const filtradas = useMemo(() => ofertas.filter((o) => {
    if (soAtivas && !o.ativo) return false;
    if (soValidados && o.vitrine_fornecedores?.status !== 'validado') return false;
    if (o.vitrine_fornecedores?.status === 'inativo' && soAtivas) return false;
    if (produtoId !== ALL && o.produto_id !== produtoId) return false;
    if (mes !== ALL && !(o.meses || []).includes(Number(mes))) return false;
    if (assentamento !== ALL && o.vitrine_fornecedores?.settlement_id !== assentamento) return false;
    if (busca && !(
      textIncludes(o.vitrine_produtos?.nome, busca) ||
      textIncludes(o.vitrine_variedades?.nome, busca) ||
      textIncludes(o.vitrine_fornecedores?.nome, busca)
    )) return false;
    return true;
  }), [ofertas, soAtivas, soValidados, produtoId, mes, assentamento, busca]);

  // Total disponível (por unidade) quando um produto está filtrado.
  const totais = useMemo(() => {
    if (produtoId === ALL) return null;
    const porUnidade: Record<string, { qtd: number; n: number }> = {};
    filtradas.forEach((o) => {
      const k = o.unidade;
      porUnidade[k] = porUnidade[k] || { qtd: 0, n: 0 };
      porUnidade[k].qtd += Number(o.qtd_mensal) || 0;
      porUnidade[k].n += 1;
    });
    return porUnidade;
  }, [filtradas, produtoId]);

  const columns = [
    {
      key: 'fornecedor', header: 'Fornecedor', render: (o: Oferta) => {
        const st = statusInfo(o.vitrine_fornecedores?.status);
        return (
          <div className="min-w-0">
            <p className="font-medium truncate">{o.vitrine_fornecedores?.nome}</p>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground truncate">{o.vitrine_fornecedores?.settlements?.name || '—'}</span>
              <Badge variant="outline" className={cn('h-4 px-1.5 text-[10px]', st.cls)}>{st.label}</Badge>
            </div>
          </div>
        );
      },
    },
    {
      key: 'produto', header: 'Produto', render: (o: Oferta) => (
        <div>
          <p className="font-medium">{o.vitrine_produtos?.nome}</p>
          {o.vitrine_variedades?.nome && <p className="text-[11px] text-muted-foreground">{o.vitrine_variedades.nome}</p>}
        </div>
      ),
    },
    {
      key: 'qtd', header: 'Qtd/mês', render: (o: Oferta) =>
        o.qtd_mensal != null ? `${fmtNum(o.qtd_mensal)} ${unidadeLabel(o.unidade)}` : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'meses', header: 'Período', className: 'hidden md:table-cell', render: (o: Oferta) => (
        <div className="space-y-1"><MesesBar meses={o.meses} /><p className="text-[11px] text-muted-foreground">{mesesResumo(o.meses)}</p></div>
      ),
    },
    {
      key: 'preco', header: 'Preço', render: (o: Oferta) => o.preco != null ? (
        <div>
          <p className="font-medium">{fmtBRL(o.preco)}<span className="text-[11px] text-muted-foreground">/{unidadeLabel(o.unidade)}</span></p>
          <p className="text-[11px] text-muted-foreground">{o.preco_entregue ? 'com entrega' : 'na propriedade'}</p>
        </div>
      ) : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'entrega', header: 'Entrega', className: 'hidden lg:table-cell', render: (o: Oferta) => (
        <span className="text-sm">{o.frequencia ? frequenciaLabel(o.frequencia) : '—'}{o.entrega_propria ? ' · própria' : ''}</span>
      ),
    },
  ];

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
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Qualquer mês</SelectItem>
            {MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>Disponível em {m}</SelectItem>)}
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
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm"><Switch checked={soValidados} onCheckedChange={setSoValidados} /> Só fornecedores validados</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={soAtivas} onCheckedChange={setSoAtivas} /> Só ofertas ativas</label>
      </div>

      {totais && Object.keys(totais).length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-3 text-sm">
            <Label className="text-xs text-muted-foreground">
              Total disponível por mês{mes !== ALL ? ` em ${MESES[Number(mes) - 1]}` : ''} (ofertas filtradas)
            </Label>
            <div className="mt-1 flex flex-wrap gap-4">
              {Object.entries(totais).map(([un, t]) => (
                <p key={un}><span className="text-xl font-bold">{fmtNum(t.qtd)}</span> {unidadeLabel(un)}/mês <span className="text-muted-foreground">· {t.n} oferta(s)</span></p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
