// Análises — quanto o produtor rural economiza fazendo Grade e PC pela
// Secretaria (paga só combustível + 1 UPFM) em vez de contratar particular.
// Só leitura: usa os atendimentos já carregados na página (mesmo exercício).
import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { HandCoins, ChevronDown, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { calcularEconomia, PREMISSAS_PADRAO, type PremissasEconomia } from '@/lib/economiaProdutor';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const brl2 = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const parse = (v: string) => { const n = parseFloat(v.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

const COR_MERCADO = '#dc2626';
const COR_PRODUTOR = '#2f6b2a';
const COR_ECONOMIA = '#2563eb';

function TooltipReais({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-xl">
      <p className="mb-1 text-sm font-semibold">{label}</p>
      {payload.map((e: any) => (
        <p key={e.dataKey} className="text-xs" style={{ color: e.color }}>
          {e.name}: <span className="font-bold">{brl(Number(e.value) || 0)}</span>
        </p>
      ))}
    </div>
  );
}

export function EconomiaProdutorCard({ services, demandTypes, exercicioLabel }: {
  services: any[]; demandTypes: any[]; exercicioLabel: string;
}) {
  const [p, setP] = useState<PremissasEconomia>(PREMISSAS_PADRAO);
  const [txt, setTxt] = useState<Record<keyof PremissasEconomia, string>>({
    gradeSecretaria: '165,22', pcSecretaria: '267,15', gradeMin: '200', gradeMax: '300', pc: '400',
  });
  const editar = (k: keyof PremissasEconomia, v: string) => {
    setTxt((t) => ({ ...t, [k]: v }));
    setP((old) => ({ ...old, [k]: parse(v) }));
  };

  const nomeDoTipo = useMemo(() => {
    const m = new Map((demandTypes as any[]).map((d) => [d.id, d.name as string]));
    return (id: string) => m.get(id);
  }, [demandTypes]);

  const r = useMemo(() => calcularEconomia(services, nomeDoTipo, p), [services, nomeDoTipo, p]);

  const economia = r.total.mercado - r.total.produtor;
  const economiaMin = r.total.mercadoMin - r.total.produtor;
  const economiaMax = r.total.mercadoMax - r.total.produtor;
  const pct = r.total.mercado > 0 ? Math.round((economia / r.total.mercado) * 100) : 0;

  const linha = r.porMes.map((m) => ({
    mes: format(parseISO(`${m.chave}-01`), 'MMM/yy', { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase()),
    'Se fosse particular': Math.round(m.mercado),
    'Pago pelo produtor': Math.round(m.produtor),
    'Economia': Math.round(m.mercado - m.produtor),
  }));

  const categorias = ([
    ['grade', 'Grade', `R$ ${num(p.gradeMin)}–${num(p.gradeMax)}/h`],
    ['pc', 'PC', `R$ ${num(p.pc)}/h`],
  ] as const).map(([k, nome, precoTxt]) => {
    const c = r.porCategoria[k];
    return {
      k, nome, precoTxt, ...c,
      economia: c.mercado - c.produtor,
      porHoraProdutor: c.horas > 0 ? c.produtor / c.horas : 0,
      porHoraMercado: c.horas > 0 ? c.mercado / c.horas : 0,
    };
  }).filter((c) => c.atendimentos > 0);

  const barras = categorias.map((c) => ({
    nome: c.nome,
    'Se fosse particular': Math.round(c.mercado),
    'Pago pelo produtor': Math.round(c.produtor),
  }));

  return (
    <Card className="overflow-hidden border-emerald-500/30">
      <CardHeader className="border-b bg-gradient-to-r from-emerald-500/15 to-blue-500/5">
        <CardTitle className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-500/20 p-2"><HandCoins className="h-5 w-5 text-emerald-700" /></div>
          <div>
            <span className="text-lg">Economia do produtor rural</span>
            <p className="text-sm font-normal text-muted-foreground">
              Grade e PC pela Secretaria × contratar particular · {exercicioLabel}
            </p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        {r.total.atendimentos === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Nenhum atendimento de Grade ou PC finalizado com horas neste período.</p>
        ) : (
          <>
            {/* Destaque principal */}
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-5 text-center">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">O produtor rural economizou</p>
              <p className="mt-1 text-4xl font-black tabular-nums text-emerald-700 dark:text-emerald-400 sm:text-5xl">{brl(economia)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {pct}% a menos do que pagaria contratando particular
                {economiaMin !== economiaMax && <> · faixa de {brl(economiaMin)} a {brl(economiaMax)}</>}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {r.total.atendimentos} atendimentos · {num(r.total.horas)} horas de máquina trabalhadas
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4">
                <p className="text-xs font-medium text-red-700 dark:text-red-400">Se fosse particular</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{brl(r.total.mercado)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Preço de mercado da hora em Confresa/MT</p>
              </div>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Pago pelo produtor</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{brl(r.total.produtor)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Hora pela Secretaria: Grade {brl2(p.gradeSecretaria)} · PC {brl2(p.pcSecretaria)}</p>
              </div>
              <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-4">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Economia</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400">{brl(economia)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Valor que ficou no bolso do produtor</p>
              </div>
            </div>

            {/* Média: o que UM produtor gasta em cada caso */}
            <div className="space-y-2">
              <div>
                <p className="text-sm font-semibold">Em média, quanto gasta um produtor (e quanto custa a hora)</p>
                <p className="text-xs text-muted-foreground">
                  Por atendimento e por produtor no período (um produtor pode ter mais de um atendimento)
                </p>
              </div>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                      <th className="p-2.5 text-left font-medium">Serviço</th>
                      <th className="p-2.5 text-right font-medium">Particular</th>
                      <th className="p-2.5 text-right font-medium">Pela Secretaria</th>
                      <th className="p-2.5 text-right font-medium">Economiza</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...categorias.map((c) => ({ nome: c.nome, t: c as any })), { nome: 'Grade + PC', t: r.total as any }].flatMap(({ nome, t }) => {
                      const nAt = t.atendimentos || 1;
                      const nPr = t.produtores?.size || 1;
                      const nH = t.horas || 1;
                      return [
                        { chave: `${nome}-h`, rotulo: `${nome} · por hora`, sub: nome === 'Grade + PC' ? 'média ponderada pelas horas' : 'valor da hora', m: t.mercado / nH, p: t.produtor / nH, hora: true },
                        { chave: `${nome}-a`, rotulo: `${nome} · por atendimento`, sub: `${num(t.horas / nAt)} h em média`, m: t.mercado / nAt, p: t.produtor / nAt },
                        { chave: `${nome}-p`, rotulo: `${nome} · por produtor`, sub: `${t.produtores?.size ?? 0} produtores`, m: t.mercado / nPr, p: t.produtor / nPr },
                      ];
                    }).map((l) => (
                      <tr key={l.chave} className={cn('border-b last:border-0', l.chave.startsWith('Grade + PC') && 'bg-emerald-500/5 font-medium', (l as any).hora && 'bg-amber-500/5 font-semibold')}>
                        <td className="p-2.5">
                          <p>{l.rotulo}</p>
                          <p className="text-[11px] font-normal text-muted-foreground">{l.sub}</p>
                        </td>
                        <td className="p-2.5 text-right tabular-nums text-red-700 dark:text-red-400">{(l as any).hora ? `${brl2(l.m)}/h` : brl(l.m)}</td>
                        <td className="p-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{(l as any).hora ? `${brl2(l.p)}/h` : brl(l.p)}</td>
                        <td className="p-2.5 text-right tabular-nums font-semibold text-blue-700 dark:text-blue-400">{(l as any).hora ? `${brl2(l.m - l.p)}/h` : brl(l.m - l.p)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Comparativo mensal em linha */}
            <div className="space-y-2">
              <div>
                <p className="text-sm font-semibold">Mês a mês</p>
                <p className="text-xs text-muted-foreground">Quanto custaria particular × quanto o produtor pagou, pelas horas trabalhadas em cada mês</p>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={linha} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} width={64} tickFormatter={(v) => `R$ ${Number(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`} />
                  <Tooltip content={<TooltipReais />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="Se fosse particular" stroke={COR_MERCADO} strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Pago pelo produtor" stroke={COR_PRODUTOR} strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Economia" stroke={COR_ECONOMIA} strokeWidth={2} strokeDasharray="5 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Por categoria */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-semibold">Nosso valor × mercado, por serviço</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barras} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 10 }} width={64} tickFormatter={(v) => `R$ ${Number(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`} />
                    <Tooltip content={<TooltipReais />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Se fosse particular" fill={COR_MERCADO} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Pago pelo produtor" fill={COR_PRODUTOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2.5">
                {categorias.map((c) => {
                  const pctC = c.mercado > 0 ? Math.round((c.economia / c.mercado) * 100) : 0;
                  return (
                    <div key={c.k} className="rounded-xl border p-3.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold">{c.nome}</p>
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          economia de {pctC}%
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{c.atendimentos} atendimentos · {num(c.horas)} h</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-red-500/5 p-2">
                          <p className="text-muted-foreground">Hora particular</p>
                          <p className="font-bold">{c.precoTxt}</p>
                        </div>
                        <div className="rounded-lg bg-emerald-500/5 p-2">
                          <p className="text-muted-foreground">Hora pela Secretaria</p>
                          <p className="font-bold">{brl2(c.porHoraProdutor)}/h</p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs">
                        Economia: <strong className="text-emerald-700 dark:text-emerald-400">{brl(c.economia)}</strong>
                        {c.mercadoMin !== c.mercadoMax && (
                          <span className="text-muted-foreground"> (de {brl(c.mercadoMin - c.produtor)} a {brl(c.mercadoMax - c.produtor)})</span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Premissas do cálculo (editáveis, não são salvas) */}
        <Collapsible>
          <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-left text-xs font-medium">
            <span className="flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> Como é calculado (valores de referência)</span>
            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">
              Particular = horas trabalhadas × preço da hora no mercado (Grade pela média da faixa).
              Pela Secretaria = horas trabalhadas × valor da hora pela Secretaria (combustível + UPFM).
              Considera atendimentos de Grade e PC finalizados com horas.
              Os valores abaixo podem ser ajustados para simular; não são salvos.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {([
                ['gradeMin', 'Grade — hora mín. (R$)'],
                ['gradeMax', 'Grade — hora máx. (R$)'],
                ['pc', 'PC — hora (R$)'],
                ['gradeSecretaria', 'Grade — hora Secretaria (R$)'],
                ['pcSecretaria', 'PC — hora Secretaria (R$)'],
              ] as const).map(([k, label]) => (
                <div key={k} className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">{label}</Label>
                  <Input value={txt[k]} onChange={(e) => editar(k, e.target.value)} inputMode="decimal" className={cn('h-8 text-sm')} />
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
