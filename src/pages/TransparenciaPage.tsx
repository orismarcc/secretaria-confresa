// Painel PÚBLICO de transparência (sem login). Só números agregados vindos de
// transparencia_resumo() — nenhum nome, CPF, telefone ou localização de pessoa.
// Assentamentos com menos de 3 produtores atendidos no ano aparecem somados em
// "Outros" para não identificar ninguém.
// Linguagem simples e explicada: o público é a população em geral.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tractor, Users, Clock, Map as MapIcon, Hourglass, ShieldCheck, Home, CalendarDays,
  Trophy, Sprout, HelpCircle, ChevronDown, Info,
} from 'lucide-react';
import logo from '@/assets/logo-transparent.png';
import { useTransparencia, type TransparenciaResumo } from '@/hooks/useSupabaseData';
import { cn } from '@/lib/utils';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_EXTENSO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const n = (v: number, d = 0) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });
const pct = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

/** Lista com barra de proporção (mais fácil de ler que tabela). */
function ListaComBarras({ itens, cor }: { itens: { rotulo: string; valor: number; detalhe?: string }[]; cor: string }) {
  const total = itens.reduce((s, x) => s + x.valor, 0);
  const max = Math.max(1, ...itens.map((x) => x.valor));
  if (itens.length === 0) return <p className="text-sm text-muted-foreground py-2">Ainda não há atendimentos neste ano.</p>;
  return (
    <ul className="space-y-3">
      {itens.map((x) => (
        <li key={x.rotulo}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{x.rotulo}</span>
            <span className="shrink-0 tabular-nums">
              <span className="font-bold">{n(x.valor)}</span>
              <span className="text-muted-foreground"> · {pct(x.valor, total)}%</span>
            </span>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full', cor)} style={{ width: `${(x.valor / max) * 100}%` }} />
          </div>
          {x.detalhe && <p className="mt-0.5 text-xs text-muted-foreground">{x.detalhe}</p>}
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
        className="w-full flex items-center gap-2 py-3 text-left text-sm font-medium hover:text-primary">
        <HelpCircle className="h-4 w-4 text-primary shrink-0" />
        <span className="flex-1">{titulo}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', aberta && 'rotate-180')} />
      </button>
      {aberta && <div className="pb-3 pl-6 text-sm text-muted-foreground leading-relaxed">{children}</div>}
    </div>
  );
}

export default function TransparenciaPage() {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const { data, isLoading, isError } = useTransparencia(ano);

  const porMes = MESES.map((m, i) => ({ mes: m, atendimentos: data?.por_mes.find((x) => x.mes === i + 1)?.atendimentos ?? 0 }));
  const mesTop = data ? porMes.reduce((a, b) => (b.atendimentos > a.atendimentos ? b : a), porMes[0]) : null;
  const tipoTop = data?.por_tipo?.[0];
  const assentTop = data?.por_assentamento?.filter((a) => a.assentamento !== 'Outros')
    .reduce<TransparenciaResumo['por_assentamento'][number] | null>((a, b) => (!a || b.atendimentos > a.atendimentos ? b : a), null);

  const cards = data ? [
    { l: 'Atendimentos realizados', v: n(data.totais.atendimentos), i: Tractor, cor: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40',
      e: 'Serviços com máquinas feitos nas propriedades rurais (gradagem, pá carregadeira, calcário e outros).' },
    { l: 'Produtores atendidos', v: n(data.totais.produtores_atendidos), i: Users, cor: 'text-blue-700 bg-blue-50 dark:bg-blue-950/40',
      e: 'Famílias produtoras diferentes que receberam pelo menos um serviço.' },
    { l: 'Assentamentos atendidos', v: n(data.totais.assentamentos_atendidos), i: Home, cor: 'text-violet-700 bg-violet-50 dark:bg-violet-950/40',
      e: 'Comunidades rurais e assentamentos que receberam atendimento.' },
    { l: 'Horas de máquina', v: n(data.totais.horas_maquina, 1), i: Clock, cor: 'text-amber-700 bg-amber-50 dark:bg-amber-950/40',
      e: 'Tempo total em que as máquinas da Prefeitura trabalharam para os produtores.' },
    { l: 'Hectares trabalhados', v: n(data.totais.hectares, 1), i: MapIcon, cor: 'text-lime-700 bg-lime-50 dark:bg-lime-950/40',
      e: 'Área de terra preparada. 1 hectare é mais ou menos o tamanho de um campo de futebol.' },
    { l: 'Pedidos aguardando hoje', v: n(data.em_aberto_hoje), i: Hourglass, cor: 'text-rose-700 bg-rose-50 dark:bg-rose-950/40',
      e: 'Pedidos de serviço já registrados que ainda vão ser atendidos.' },
  ] : [];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center gap-3">
          <img src={logo} alt="Secretaria de Agricultura" className="h-11 w-auto" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold leading-tight">Portal da Transparência</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Secretaria Municipal de Agricultura · Prefeitura de Confresa/MT</p>
          </div>
          <Link to="/login" className="text-xs text-primary hover:underline shrink-0">Acesso da equipe</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Apresentação + escolha do ano */}
        <section className="rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
            <div className="space-y-1.5">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                <Sprout className="h-4 w-4" /> Apoio ao produtor rural
              </p>
              <h2 className="text-xl sm:text-2xl font-bold leading-snug">
                O que a Secretaria de Agricultura fez pelos produtores em {ano}
              </h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Aqui você acompanha, em números, os serviços feitos com as máquinas da Prefeitura nas propriedades
                rurais do município. Os dados são atualizados automaticamente pelo sistema da Secretaria.
              </p>
            </div>
            <div className="shrink-0 space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Escolha o ano</p>
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger className="w-[130px] bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {isError ? (
          <p className="rounded-lg border bg-card p-4 text-sm text-destructive">Não foi possível carregar os dados agora. Tente novamente mais tarde.</p>
        ) : isLoading || !data ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
        ) : (
          <>
            {/* Números principais, cada um explicado */}
            <section aria-label="Números principais" className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((c) => (
                <div key={c.l} className="rounded-xl border bg-card p-4 flex gap-3">
                  <div className={cn('h-11 w-11 shrink-0 rounded-lg flex items-center justify-center', c.cor)}>
                    <c.i className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-3xl font-black leading-none tabular-nums">{c.v}</p>
                    <p className="mt-1 text-sm font-semibold">{c.l}</p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{c.e}</p>
                  </div>
                </div>
              ))}
            </section>

            {/* Destaques em frases simples */}
            {data.totais.atendimentos > 0 && (
              <section className="rounded-xl border bg-card p-4 sm:p-5">
                <h2 className="text-base font-semibold flex items-center gap-2 mb-3"><Trophy className="h-4 w-4 text-amber-600" /> Destaques de {ano}</h2>
                <ul className="grid gap-2 sm:grid-cols-3 text-sm">
                  {mesTop && mesTop.atendimentos > 0 && (
                    <li className="rounded-lg bg-muted/50 p-3">
                      Mês com mais atendimentos: <b>{MESES_EXTENSO[MESES.indexOf(mesTop.mes)]}</b>, com <b>{n(mesTop.atendimentos)}</b> serviços.
                    </li>
                  )}
                  {tipoTop && (
                    <li className="rounded-lg bg-muted/50 p-3">
                      Serviço mais pedido: <b>{tipoTop.tipo}</b> ({n(tipoTop.atendimentos)} atendimentos).
                    </li>
                  )}
                  {assentTop && (
                    <li className="rounded-lg bg-muted/50 p-3">
                      Assentamento mais atendido: <b>{assentTop.assentamento}</b> ({n(assentTop.atendimentos)} atendimentos).
                    </li>
                  )}
                </ul>
              </section>
            )}

            {/* Por mês */}
            <section className="rounded-xl border bg-card p-4 sm:p-5">
              <h2 className="text-base font-semibold">Atendimentos realizados mês a mês</h2>
              <p className="text-xs text-muted-foreground mb-3">Cada barra mostra quantos serviços foram concluídos naquele mês de {ano}.</p>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porMes} margin={{ top: 18, right: 4, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mes" fontSize={12} />
                    <YAxis allowDecimals={false} fontSize={11} width={34} />
                    <Tooltip formatter={(v: number) => [n(v), 'Atendimentos']} />
                    <Bar dataKey="atendimentos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="atendimentos" position="top" fontSize={10} formatter={(v: number) => (v > 0 ? n(v) : '')} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-xl border bg-card p-4 sm:p-5">
                <h2 className="text-base font-semibold">Quais serviços foram feitos</h2>
                <p className="text-xs text-muted-foreground mb-3">Quantidade de atendimentos de cada tipo e a parte que representa do total.</p>
                <ListaComBarras cor="bg-emerald-600" itens={data.por_tipo.map((t) => ({ rotulo: t.tipo, valor: t.atendimentos }))} />
              </section>
              <section className="rounded-xl border bg-card p-4 sm:p-5">
                <h2 className="text-base font-semibold">Onde os serviços foram feitos</h2>
                <p className="text-xs text-muted-foreground mb-3">Atendimentos por assentamento ou comunidade rural.</p>
                <ListaComBarras
                  cor="bg-blue-600"
                  itens={data.por_assentamento.map((a) => ({
                    rotulo: a.assentamento,
                    valor: a.atendimentos,
                    detalhe: `${n(a.produtores)} produtor${a.produtores === 1 ? '' : 'es'} atendido${a.produtores === 1 ? '' : 's'} · ${n(a.horas, 1)} horas de máquina`,
                  }))}
                />
              </section>
            </div>

            {/* Entenda os números */}
            <section className="rounded-xl border bg-card p-4 sm:p-5">
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

            <p className="text-xs text-muted-foreground flex gap-1.5 px-1">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
              <span>
                Painel em conformidade com a Lei de Acesso à Informação (Lei 12.527/2011) e a Lei Geral de Proteção de Dados
                (Lei 13.709/2018): são mostrados somente números totais, sem nomes, documentos ou endereços de pessoas.
              </span>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
