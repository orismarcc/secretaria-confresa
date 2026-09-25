import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSpreadsheet, CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOfertas } from './hooks';
import { CATEGORIAS, MESES, unidadeLabel, fmtNum, categoriaLabel } from './constants';
import { exportarCalendarioXlsx } from './exportar';

const ALL = '__all__';

interface Linha {
  key: string;
  produtoId: string;
  produto: string;
  categoria: string;
  unidade: string;
  porMes: number[];        // soma da qtd/mês disponível em cada mês
  fornecedoresMes: number[]; // nº de fornecedores distintos por mês
}

/**
 * Calendário da oferta: produto × mês com o total disponível (soma das
 * quantidades mensais das ofertas ativas que incluem o mês). Clicar numa célula
 * abre a Busca filtrada por aquele produto e mês.
 */
export function CalendarioTab({ onPick }: { onPick: (produtoId: string, mes: number) => void }) {
  const { data: ofertas = [], isLoading } = useOfertas();
  const [soValidados, setSoValidados] = useState(false);
  const [categoria, setCategoria] = useState(ALL);
  // Visão: todas as ofertas | validadas + aceitas | só aceitas (cobertura garantida).
  const [visao, setVisao] = useState<'todas' | 'validadas' | 'aceitas'>('todas');
  const mesAtual = new Date().getMonth() + 1;

  const linhas = useMemo(() => {
    const map = new Map<string, Linha & { _f: Set<string>[] }>();
    ofertas.forEach((o) => {
      const st = o.vitrine_fornecedores?.status;
      if (!o.ativo || st === 'inativo' || o.situacao === 'suspensa') return;
      if (soValidados && st !== 'validado') return;
      if (visao === 'validadas' && o.situacao !== 'validada' && o.situacao !== 'aceita') return;
      if (visao === 'aceitas' && o.situacao !== 'aceita') return;
      const cat = o.vitrine_produtos?.categoria || 'outro';
      if (categoria !== ALL && cat !== categoria) return;
      const key = `${o.produto_id}|${o.unidade}`;
      if (!map.has(key)) {
        map.set(key, {
          key, produtoId: o.produto_id, produto: o.vitrine_produtos?.nome || '', categoria: cat, unidade: o.unidade,
          porMes: Array(12).fill(0), fornecedoresMes: Array(12).fill(0), _f: Array.from({ length: 12 }, () => new Set<string>()),
        });
      }
      const l = map.get(key)!;
      (o.meses || []).forEach((m) => {
        if (m < 1 || m > 12) return;
        // Na visão "só aceitas" soma a quantidade ACEITA (se informada).
        l.porMes[m - 1] += Number(visao === 'aceitas' ? (o.qtd_aceita ?? o.qtd_mensal) : o.qtd_mensal) || 0;
        l._f[m - 1].add(o.fornecedor_id);
      });
    });
    return [...map.values()]
      .map((l) => ({ ...l, fornecedoresMes: l._f.map((s) => s.size) }))
      .sort((a, b) => a.produto.localeCompare(b.produto, 'pt-BR'));
  }, [ofertas, soValidados, categoria, visao]);

  const exportar = () => exportarCalendarioXlsx(
    linhas.map((l) => ({ produto: l.produto, unidade: unidadeLabel(l.unidade), porMes: l.porMes })),
    `Conecta Confresa — Calendário da oferta · ${visao === 'aceitas' ? 'só aceitas (cobertura)' : visao === 'validadas' ? 'validadas e aceitas' : 'todas as ofertas'}${soValidados ? ' · só fornecedores validados' : ''}${categoria !== ALL ? ` · ${categoriaLabel(categoria)}` : ''}`,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as categorias</SelectItem>
            {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={visao} onValueChange={(v) => setVisao(v as typeof visao)}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as ofertas</SelectItem>
            <SelectItem value="validadas">Validadas e aceitas</SelectItem>
            <SelectItem value="aceitas">Só aceitas (cobertura)</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm"><Switch checked={soValidados} onCheckedChange={setSoValidados} /> Só fornecedores validados</label>
        <Button variant="outline" size="sm" className="ml-auto" disabled={linhas.length === 0} onClick={exportar}>
          <FileSpreadsheet className="h-4 w-4 mr-1" /> Planilha
        </Button>
      </div>

      {isLoading ? null : linhas.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <CalendarRange className="h-8 w-8 mx-auto mb-2 text-primary" />
          Nenhuma oferta ativa para montar o calendário.
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted/90 text-left font-semibold px-3 py-2 min-w-[150px]">Produto</th>
                {MESES.map((m, i) => (
                  <th key={m} className={cn('px-1 py-2 font-semibold text-center min-w-[58px]', i + 1 === mesAtual && 'text-primary underline underline-offset-4')}>{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const max = Math.max(...l.porMes, 1);
                return (
                  <tr key={l.key} className="border-t">
                    <td className="sticky left-0 z-10 bg-background px-3 py-1.5">
                      <p className="font-medium">{l.produto}</p>
                      <p className="text-[10px] text-muted-foreground">{unidadeLabel(l.unidade)}/mês</p>
                    </td>
                    {l.porMes.map((v, i) => {
                      const alpha = v > 0 ? 0.15 + 0.75 * (v / max) : 0;
                      return (
                        <td key={i} className="p-0.5 text-center">
                          {v > 0 ? (
                            <button
                              type="button"
                              onClick={() => onPick(l.produtoId, i + 1)}
                              title={`${l.produto} em ${MESES[i]}: ${fmtNum(v)} ${unidadeLabel(l.unidade)} · ${l.fornecedoresMes[i]} fornecedor(es)`}
                              className="w-full rounded px-1 py-1.5 leading-tight hover:ring-2 hover:ring-primary"
                              style={{ backgroundColor: `hsl(var(--primary) / ${alpha.toFixed(2)})` }}
                            >
                              <span className={cn('block font-semibold', alpha > 0.55 ? 'text-primary-foreground' : 'text-foreground')}>{fmtNum(v)}</span>
                              <span className={cn('block text-[9px]', alpha > 0.55 ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{l.fornecedoresMes[i]} forn.</span>
                            </button>
                          ) : visao === 'aceitas' ? (
                            // Produto aceito em outros meses, mas SEM cobertura neste: risco de faltar.
                            <span className="block rounded py-2 bg-red-500/15 text-red-700 dark:text-red-400 text-[10px] font-semibold" title="Sem oferta aceita neste mês">falta</span>
                          ) : (
                            <span className="block rounded py-2.5 bg-muted/40 text-muted-foreground/60">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        {visao === 'aceitas'
          ? 'Soma das quantidades ACEITAS por mês. "falta" = produto com aceite em outros meses, mas sem nenhuma oferta aceita neste — risco de faltar na distribuição.'
          : 'Soma das quantidades mensais que os fornecedores declararam para cada mês. Toque numa célula para ver quem fornece. Meses sem oferta (—) indicam onde a agricultura familiar local não atende hoje.'}
      </p>
    </div>
  );
}
