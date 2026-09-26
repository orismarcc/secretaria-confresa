// Custo por hora-máquina (Frotas). Cálculo no banco (custo_maquinas):
// (combustível com preço + manutenção) ÷ horas trabalhadas nos atendimentos
// finalizados do período. Sinaliza o que falta para o custo ficar completo.
import { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Calculator, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCustoMaquinas } from '@/hooks/useSupabaseData';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (n: number, d = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: d });
const iso = (d: Date) => format(d, 'yyyy-MM-dd');

type Periodo = 'mes' | 'mes_passado' | 'tres' | 'ano' | 'pers';

export function CustoMaquinasPanel() {
  const [aberto, setAberto] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>('ano');
  const hoje = new Date();
  const [ini, setIni] = useState(iso(startOfMonth(hoje)));
  const [fim, setFim] = useState(iso(hoje));

  const [inicio, termino] = useMemo<[string, string]>(() => {
    switch (periodo) {
      case 'mes': return [iso(startOfMonth(hoje)), iso(endOfMonth(hoje))];
      case 'mes_passado': { const m = subMonths(hoje, 1); return [iso(startOfMonth(m)), iso(endOfMonth(m))]; }
      case 'tres': return [iso(startOfMonth(subMonths(hoje, 2))), iso(endOfMonth(hoje))];
      case 'ano': return [iso(startOfYear(hoje)), iso(hoje)];
      default: return [ini, fim];
    }
  }, [periodo, ini, fim]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data = [], isLoading, isError } = useCustoMaquinas(aberto ? inicio : '', aberto ? termino : '');

  // Consumo fora do normal: litros/hora acima de 1,5× a mediana das máquinas.
  const medianaLh = useMemo(() => {
    const v = data.map((d) => d.litros_hora).filter((x): x is number => x != null && x > 0).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  }, [data]);

  const tot = useMemo(() => data.reduce((a, d) => ({
    horas: a.horas + d.horas, litros: a.litros + d.litros, comb: a.comb + d.custo_combustivel,
    man: a.man + d.custo_manutencao, total: a.total + d.custo_total, semPreco: a.semPreco + d.litros_sem_preco,
    semCusto: a.semCusto + d.manutencoes_sem_custo,
  }), { horas: 0, litros: 0, comb: 0, man: 0, total: 0, semPreco: 0, semCusto: 0 }), [data]);

  return (
    <div className="rounded-lg border">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40 rounded-lg">
        <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', aberto && 'rotate-90')} />
        <Calculator className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm flex-1">Custo por hora-máquina</span>
        <span className="text-[11px] text-muted-foreground">{aberto ? 'recolher' : 'ver custos'}</span>
      </button>

      {aberto && (
        <div className="space-y-3 p-3 pt-0">
          <div className="flex flex-wrap items-end gap-2">
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="w-[190px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Este mês</SelectItem>
                <SelectItem value="mes_passado">Mês passado</SelectItem>
                <SelectItem value="tres">Últimos 3 meses</SelectItem>
                <SelectItem value="ano">Este ano</SelectItem>
                <SelectItem value="pers">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            {periodo === 'pers' && (
              <>
                <Input type="date" className="h-9 w-[150px]" value={ini} onChange={(e) => setIni(e.target.value)} />
                <Input type="date" className="h-9 w-[150px]" value={fim} onChange={(e) => setFim(e.target.value)} />
              </>
            )}
          </div>

          {isError ? (
            <p className="text-sm text-destructive">Não foi possível calcular os custos agora.</p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">Calculando…</p>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum atendimento, abastecimento ou manutenção no período.</p>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-2 py-2 font-medium">Máquina</th>
                      <th className="px-2 py-2 font-medium text-right">Atend.</th>
                      <th className="px-2 py-2 font-medium text-right">Horas</th>
                      <th className="px-2 py-2 font-medium text-right">Litros</th>
                      <th className="px-2 py-2 font-medium text-right">L/h</th>
                      <th className="px-2 py-2 font-medium text-right">Combustível</th>
                      <th className="px-2 py-2 font-medium text-right">Manutenção</th>
                      <th className="px-2 py-2 font-medium text-right">Total</th>
                      <th className="px-2 py-2 font-medium text-right">Custo/hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((d) => {
                      const consumoAlto = medianaLh != null && d.litros_hora != null && d.litros_hora > medianaLh * 1.5;
                      return (
                        <tr key={d.machinery_id} className="border-t">
                          <td className="px-2 py-1.5 min-w-[140px]">
                            <p className="font-medium">{d.nome}</p>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {d.litros_sem_preco > 0 && <Badge variant="outline" className="h-auto py-0 px-1 text-[9px] whitespace-nowrap border-amber-500/50 text-amber-700 dark:text-amber-400">{num(d.litros_sem_preco)} L sem preço</Badge>}
                              {d.manutencoes_sem_custo > 0 && <Badge variant="outline" className="h-auto py-0 px-1 text-[9px] whitespace-nowrap border-amber-500/50 text-amber-700 dark:text-amber-400">{d.manutencoes_sem_custo} manut. sem valor</Badge>}
                              {d.horas === 0 && <Badge variant="outline" className="h-auto py-0 px-1 text-[9px] whitespace-nowrap">sem horas no período</Badge>}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{d.atendimentos}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{num(d.horas)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{num(d.litros)}</td>
                          <td className={cn('px-2 py-1.5 text-right tabular-nums', consumoAlto && 'text-red-600 font-semibold')}
                            title={consumoAlto ? 'Consumo acima de 1,5× o normal das máquinas' : undefined}>
                            {d.litros_hora != null ? num(d.litros_hora) : '—'}{consumoAlto && ' ⚠'}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{brl(d.custo_combustivel)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{brl(d.custo_manutencao)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-medium">{brl(d.custo_total)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{d.custo_hora != null ? brl(d.custo_hora) : '—'}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t bg-muted/30 font-semibold">
                      <td className="px-2 py-1.5">Total</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{data.reduce((s, d) => s + d.atendimentos, 0)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{num(tot.horas)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{num(tot.litros)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{tot.horas > 0 ? num(tot.litros / tot.horas) : '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{brl(tot.comb)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{brl(tot.man)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{brl(tot.total)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{tot.horas > 0 ? brl(tot.total / tot.horas) : '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {(tot.semPreco > 0 || tot.semCusto > 0) && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 flex gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Custo incompleto: {tot.semPreco > 0 ? `${num(tot.semPreco)} L abastecidos sem preço` : ''}
                  {tot.semPreco > 0 && tot.semCusto > 0 ? ' e ' : ''}
                  {tot.semCusto > 0 ? `${tot.semCusto} manutenção(ões) sem valor` : ''}. Informe o preço do litro nos abastecimentos e o valor nas manutenções.
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Custo/hora = (combustível com preço + manutenções) ÷ horas trabalhadas nos atendimentos finalizados do período.
                ⚠ = consumo (L/h) acima de 1,5× o normal entre as máquinas.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
