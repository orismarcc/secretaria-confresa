// Painel PÚBLICO de transparência (sem login). Só números agregados vindos de
// transparencia_resumo() — nenhum nome, CPF, telefone ou localização de pessoa.
// Assentamentos com menos de 3 produtores atendidos no ano aparecem somados em
// "Outros" para não identificar ninguém.
// Linguagem simples e explicada: o público é a população em geral.
// Interativo: números que contam, cards que levam à seção, barras animadas,
// gráfico com troca de indicador. Animações em src/lib/movimento.tsx
// (respeitam "reduzir movimento" do aparelho).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tractor, Users, Clock, Map as MapIcon, Hourglass, ShieldCheck, Home, CalendarDays,
  Trophy, Sprout, HelpCircle, ChevronDown, Info, ArrowDown, MousePointerClick,
} from 'lucide-react';
import logo from '@/assets/logo-transparent.png';
import { useTransparencia, type TransparenciaResumo } from '@/hooks/useSupabaseData';
import { cn } from '@/lib/utils';
import { Revelar, Contador, useEmCena } from '@/lib/movimento';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_EXTENSO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const n = (v: number, d = 0) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });
const pct = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

const irPara = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** Lista com barra de proporção (as barras "crescem" ao aparecer na tela). */
function ListaComBarras({ itens, cor }: { itens: { rotulo: string; valor: number; detalhe?: string }[]; cor: string }) {
  const { ref, visto } = useEmCena<HTMLUListElement>();
  const [ativo, setAtivo] = useState<string | null>(null);
  const total = itens.reduce((s, x) => s + x.valor, 0);
  const max = Math.max(1, ...itens.map((x) => x.valor));
  if (itens.length === 0) return <p className="text-sm text-muted-foreground py-2">Ainda não há atendimentos neste ano.</p>;
  return (
    <ul ref={ref} className="space-y-1">
      {itens.map((x, i) => (
        <li key={x.rotulo}>
          <button
            type="button"
            onClick={() => setAtivo((a) => (a === x.rotulo ? null : x.rotulo))}
            className={cn('w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60',
              ativo === x.rotulo && 'bg-muted/70')}
            aria-expanded={ativo === x.rotulo}
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{x.rotulo}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-bold">{n(x.valor)}</span>
                <span className="text-muted-foreground"> · {pct(x.valor, total)}%</span>
              </span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-[width] duration-1000 ease-out', cor)}
                style={{ width: visto ? `${(x.valor / max) * 100}%` : '0%', transitionDelay: `${Math.min(i, 12) * 60}ms` }}
              />
            </div>
            <div className={cn('grid transition-all duration-300', ativo === x.rotulo ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0')}>
              <p className="overflow-hidden text-xs text-muted-foreground">
                {x.detalhe ? `${x.detalhe} · ` : ''}{pct(x.valor, total)}% de todos os atendimentos do ano.
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Pergunta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const [aberta, setAberta] = useState(false);
  return (
    <div className="border-t first:border-t-0">
      <button type="button" onClick={() => setAberta((a) => !a)} aria-expanded={aberta}
        className="group w-full flex items-center gap-2 py-3 text-left text-sm font-medium hover:text-primary">
        <HelpCircle className="h-4 w-4 text-primary shrink-0 transition-transform group-hover:scale-110" />
        <span className="flex-1">{titulo}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform duration-300', aberta && 'rotate-180')} />
      </button>
      <div className={cn('grid transition-all duration-300 ease-out', aberta ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
        <div className="overflow-hidden">
          <p className="pb-3 pl-6 text-sm text-muted-foreground leading-relaxed">{children}</p>
        </div>
      </div>
    </div>
  );
}

type Indicador = 'atendimentos' | 'horas';

export default function TransparenciaPage() {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [indicador, setIndicador] = useState<Indicador>('atendimentos');
  const [mesSel, setMesSel] = useState<number | null>(null);
  const { data, isLoading, isError } = useTransparencia(ano);

  const porMes = MESES.map((m, i) => {
    const x = data?.por_mes.find((y) => y.mes === i + 1);
    return { mes: m, atendimentos: x?.atendimentos ?? 0, horas: Number(x?.horas ?? 0) };
  });
  const mesTop = data ? porMes.reduce((a, b) => (b.atendimentos > a.atendimentos ? b : a), porMes[0]) : null;
  const tipoTop = data?.por_tipo?.[0];
  const assentTop = data?.por_assentamento?.filter((a) => a.assentamento !== 'Outros')
    .reduce<TransparenciaResumo['por_assentamento'][number] | null>((a, b) => (!a || b.atendimentos > a.atendimentos ? b : a), null);

  const cards = data ? [
    { l: 'Atendimentos realizados', v: data.totais.atendimentos, d: 0, i: Tractor, cor: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/50', anel: 'hover:ring-emerald-300', alvo: 'sec-meses',
      e: 'Serviços com máquinas feitos nas propriedades rurais (gradagem, pá carregadeira, calcário e outros).' },
    { l: 'Produtores atendidos', v: data.totais.produtores_atendidos, d: 0, i: Users, cor: 'text-blue-700 bg-blue-100 dark:bg-blue-950/50', anel: 'hover:ring-blue-300', alvo: 'sec-onde',
      e: 'Famílias produtoras diferentes que receberam pelo menos um serviço.' },
    { l: 'Assentamentos atendidos', v: data.totais.assentamentos_atendidos, d: 0, i: Home, cor: 'text-violet-700 bg-violet-100 dark:bg-violet-950/50', anel: 'hover:ring-violet-300', alvo: 'sec-onde',
      e: 'Comunidades rurais e assentamentos que receberam atendimento.' },
    { l: 'Horas de máquina', v: data.totais.horas_maquina, d: 1, i: Clock, cor: 'text-amber-700 bg-amber-100 dark:bg-amber-950/50', anel: 'hover:ring-amber-300', alvo: 'sec-meses',
      e: 'Tempo total em que as máquinas da Prefeitura trabalharam para os produtores.' },
    { l: 'Hectares trabalhados', v: data.totais.hectares, d: 1, i: MapIcon, cor: 'text-lime-700 bg-lime-100 dark:bg-lime-950/50', anel: 'hover:ring-lime-300', alvo: 'sec-entenda',
      e: 'Área de terra preparada. 1 hectare é mais ou menos o tamanho de um campo de futebol.' },
    { l: 'Pedidos aguardando hoje', v: data.em_aberto_hoje, d: 0, i: Hourglass, cor: 'text-rose-700 bg-rose-100 dark:bg-rose-950/50', anel: 'hover:ring-rose-300', alvo: 'sec-entenda',
      e: 'Pedidos de serviço já registrados que ainda vão ser atendidos.' },
  ] : [];

  const mesInfo = mesSel != null ? porMes[mesSel] : null;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <img src={logo} alt="Secretaria de Agricultura" className="h-10 w-auto" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold leading-tight">Portal da Transparência</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">Secretaria Municipal de Agricultura · Prefeitura de Confresa/MT</p>
          </div>
          <Link to="/login" className="text-xs text-primary hover:underline shrink-0">Acesso da equipe</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Apresentação + escolha do ano */}
        <Revelar>
          <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-card to-card p-5 sm:p-7">
            {/* formas decorativas em movimento lento */}
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/15 blur-2xl animate-pulse" />
            <div aria-hidden className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-amber-300/20 blur-2xl animate-pulse [animation-delay:1.2s]" />
            <div className="relative flex flex-col gap-5">
              <div className="space-y-2">
                <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  <Sprout className="h-4 w-4" /> Apoio ao produtor rural
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold leading-snug">
                  O que a Secretaria de Agricultura fez pelos produtores em {ano}
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
                  Aqui você acompanha, em números, os serviços feitos com as máquinas da Prefeitura nas propriedades
                  rurais do município. Os dados são atualizados automaticamente pelo sistema da Secretaria.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Ano:</span>
                <div role="radiogroup" aria-label="Escolha o ano" className="inline-flex rounded-full border bg-card p-1 shadow-sm">
                  {[anoAtual - 2, anoAtual - 1, anoAtual].map((a) => (
                    <button
                      key={a}
                      type="button"
                      role="radio"
                      aria-checked={ano === a}
                      onClick={() => { setAno(a); setMesSel(null); }}
                      className={cn('rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-300',
                        ano === a ? 'bg-primary text-primary-foreground shadow scale-105' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}
                    >
                      {a}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => irPara('sec-numeros')}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow transition-transform hover:scale-105 active:scale-95">
                  Ver os números <ArrowDown className="h-4 w-4 animate-bounce" />
                </button>
              </div>
            </div>
          </section>
        </Revelar>

        {isError ? (
          <p className="rounded-lg border bg-card p-4 text-sm text-destructive">Não foi possível carregar os dados agora. Tente novamente mais tarde.</p>
        ) : isLoading || !data ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
        ) : (
          <div key={ano} className="space-y-6">
            {/* Números principais — tocar leva à seção relacionada */}
            <section id="sec-numeros" aria-label="Números principais" className="scroll-mt-24">
              <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><MousePointerClick className="h-3.5 w-3.5" /> Toque em um número para ver os detalhes.</p>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map((c, i) => (
                  <Revelar key={c.l} atraso={i * 90}>
                    <button
                      type="button"
                      onClick={() => irPara(c.alvo)}
                      className={cn('group h-full w-full rounded-xl border bg-card p-4 flex gap-3 text-left shadow-sm ring-0 ring-offset-0',
                        'transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:ring-2 active:translate-y-0', c.anel)}
                    >
                      <div className={cn('h-12 w-12 shrink-0 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6', c.cor)}>
                        <c.i className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-3xl font-black leading-none tabular-nums">
                          <Contador valor={c.v} formatar={(v) => n(v, c.d)} />
                        </p>
                        <p className="mt-1 text-sm font-semibold">{c.l}</p>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{c.e}</p>
                      </div>
                    </button>
                  </Revelar>
                ))}
              </div>
            </section>

            {/* Destaques em frases simples */}
            {data.totais.atendimentos > 0 && (
              <Revelar>
                <section className="rounded-xl border bg-card p-4 sm:p-5">
                  <h2 className="text-base font-semibold flex items-center gap-2 mb-3"><Trophy className="h-4 w-4 text-amber-600" /> Destaques de {ano}</h2>
                  <ul className="grid gap-2 sm:grid-cols-3 text-sm">
                    {mesTop && mesTop.atendimentos > 0 && (
                      <li className="rounded-lg bg-gradient-to-br from-amber-50 to-transparent dark:from-amber-950/30 border border-amber-200/60 p-3 transition-transform hover:scale-[1.02]">
                        📅 Mês com mais atendimentos: <b>{MESES_EXTENSO[MESES.indexOf(mesTop.mes)]}</b>, com <b>{n(mesTop.atendimentos)}</b> serviços.
                      </li>
                    )}
                    {tipoTop && (
                      <li className="rounded-lg bg-gradient-to-br from-emerald-50 to-transparent dark:from-emerald-950/30 border border-emerald-200/60 p-3 transition-transform hover:scale-[1.02]">
                        🚜 Serviço mais pedido: <b>{tipoTop.tipo}</b> ({n(tipoTop.atendimentos)} atendimentos).
                      </li>
                    )}
                    {assentTop && (
                      <li className="rounded-lg bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-950/30 border border-blue-200/60 p-3 transition-transform hover:scale-[1.02]">
                        🏡 Assentamento mais atendido: <b>{assentTop.assentamento}</b> ({n(assentTop.atendimentos)} atendimentos).
                      </li>
                    )}
                  </ul>
                </section>
              </Revelar>
            )}

            {/* Por mês — com troca de indicador e mês selecionável */}
            <Revelar>
              <section id="sec-meses" className="scroll-mt-24 rounded-xl border bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">Mês a mês</h2>
                    <p className="text-xs text-muted-foreground">Toque em uma barra para ver o mês em detalhe.</p>
                  </div>
                  <div role="radiogroup" aria-label="O que mostrar no gráfico" className="inline-flex rounded-full border bg-muted/40 p-1">
                    {([['atendimentos', 'Atendimentos'], ['horas', 'Horas de máquina']] as const).map(([v, r]) => (
                      <button key={v} type="button" role="radio" aria-checked={indicador === v} onClick={() => setIndicador(v)}
                        className={cn('rounded-full px-3 py-1 text-xs font-semibold transition-all duration-300',
                          indicador === v ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground')}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-3 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porMes} margin={{ top: 18, right: 4, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="mes" fontSize={12} />
                      <YAxis allowDecimals={indicador === 'horas'} fontSize={11} width={38} />
                      <Tooltip cursor={{ fill: 'hsl(var(--muted))' }}
                        formatter={(v: number) => [n(v, indicador === 'horas' ? 1 : 0), indicador === 'horas' ? 'Horas de máquina' : 'Atendimentos']} />
                      <Bar dataKey={indicador} radius={[5, 5, 0, 0]} animationDuration={900} className="cursor-pointer"
                        onClick={(_: unknown, i: number) => setMesSel((m) => (m === i ? null : i))}>
                        {porMes.map((_, i) => (
                          <Cell key={i} fill={mesSel === i ? 'hsl(38 92% 50%)' : 'hsl(var(--primary))'} />
                        ))}
                        <LabelList dataKey={indicador} position="top" fontSize={10}
                          formatter={(v: number) => (v > 0 ? n(v, indicador === 'horas' ? 0 : 0) : '')} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className={cn('grid transition-all duration-300', mesInfo ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0')}>
                  <div className="overflow-hidden">
                    {mesInfo && (
                      <p className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 p-3 text-sm">
                        Em <b>{MESES_EXTENSO[mesSel!]}</b> de {ano}: <b>{n(mesInfo.atendimentos)}</b> atendimento{mesInfo.atendimentos === 1 ? '' : 's'} realizado{mesInfo.atendimentos === 1 ? '' : 's'}
                        {' '}e <b>{n(mesInfo.horas, 1)}</b> horas de máquina trabalhadas.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </Revelar>

            <div className="grid gap-4 md:grid-cols-2">
              <Revelar>
                <section id="sec-servicos" className="scroll-mt-24 h-full rounded-xl border bg-card p-4 sm:p-5">
                  <h2 className="text-base font-semibold">Quais serviços foram feitos</h2>
                  <p className="text-xs text-muted-foreground mb-3">Toque em um serviço para ver a parte que ele representa.</p>
                  <ListaComBarras cor="bg-emerald-600" itens={data.por_tipo.map((t) => ({ rotulo: t.tipo, valor: t.atendimentos }))} />
                </section>
              </Revelar>
              <Revelar atraso={120}>
                <section id="sec-onde" className="scroll-mt-24 h-full rounded-xl border bg-card p-4 sm:p-5">
                  <h2 className="text-base font-semibold">Onde os serviços foram feitos</h2>
                  <p className="text-xs text-muted-foreground mb-3">Toque em um lugar para ver produtores e horas de máquina.</p>
                  <ListaComBarras
                    cor="bg-blue-600"
                    itens={data.por_assentamento.map((a) => ({
                      rotulo: a.assentamento,
                      valor: a.atendimentos,
                      detalhe: `${n(a.produtores)} produtor${a.produtores === 1 ? '' : 'es'} atendido${a.produtores === 1 ? '' : 's'} · ${n(a.horas, 1)} horas de máquina`,
                    }))}
                  />
                </section>
              </Revelar>
            </div>

            {/* Entenda os números */}
            <Revelar>
              <section id="sec-entenda" className="scroll-mt-24 rounded-xl border bg-card p-4 sm:p-5">
                <h2 className="text-base font-semibold flex items-center gap-2 mb-1"><Info className="h-4 w-4 text-primary" /> Entenda os números</h2>
                <div>
                  <Pergunta titulo="O que é um atendimento?">
                    É um serviço feito pela Secretaria de Agricultura na propriedade de um produtor rural, usando as máquinas da
                    Prefeitura — por exemplo, preparo do solo (gradagem), pá carregadeira ou entrega de calcário. Só entram aqui
                    os atendimentos já concluídos.
                  </Pergunta>
                  <Pergunta titulo="Por que alguns assentamentos aparecem como “Outros”?">
                    Para proteger a privacidade das famílias. Quando um lugar teve menos de 3 produtores atendidos no ano, os
                    números dele são somados em “Outros”, assim ninguém pode ser identificado.
                  </Pergunta>
                  <Pergunta titulo="O que são horas de máquina e hectares?">
                    Horas de máquina é o tempo em que os tratores e outras máquinas trabalharam para os produtores. Hectare é a
                    medida da área de terra trabalhada: 1 hectare tem 10.000 m², mais ou menos um campo de futebol.
                  </Pergunta>
                  <Pergunta titulo="O que são os pedidos aguardando?">
                    São pedidos de serviço que os produtores já fizeram e que a Secretaria registrou, mas que ainda vão ser
                    atendidos. O número muda todo dia, conforme os serviços são feitos.
                  </Pergunta>
                  <Pergunta titulo="De onde vêm esses dados?">
                    Do sistema usado no dia a dia pela Secretaria de Agricultura. Cada serviço é registrado pela equipe e pelos
                    operadores das máquinas, e este painel é atualizado automaticamente.
                  </Pergunta>
                  <Pergunta titulo="Como faço para pedir um serviço?">
                    Procure a Secretaria Municipal de Agricultura de Confresa. A equipe registra o seu pedido e ele passa a
                    contar em “Pedidos aguardando hoje” até ser atendido.
                  </Pergunta>
                </div>
              </section>
            </Revelar>

            <p className="text-xs text-muted-foreground flex gap-1.5 px-1">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
              <span>
                Painel em conformidade com a Lei de Acesso à Informação (Lei 12.527/2011) e a Lei Geral de Proteção de Dados
                (Lei 13.709/2018): são mostrados somente números totais, sem nomes, documentos ou endereços de pessoas.
              </span>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
