// Painel PÚBLICO de transparência (sem login). Só números agregados vindos de
// transparencia_resumo() — nenhum nome, CPF, telefone ou localização de pessoa.
// Assentamentos com menos de 3 produtores atendidos no ano aparecem somados em
// "Outros" para não identificar ninguém.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tractor, Users, Clock, Map as MapIcon, Hourglass, ShieldCheck } from 'lucide-react';
import logo from '@/assets/logo-transparent.png';
import { useTransparencia } from '@/hooks/useSupabaseData';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const n = (v: number, d = 0) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });

export default function TransparenciaPage() {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const { data, isLoading, isError } = useTransparencia(ano);

  const porMes = MESES.map((m, i) => ({ mes: m, atendimentos: data?.por_mes.find((x) => x.mes === i + 1)?.atendimentos ?? 0 }));
  const cards = data ? [
    { l: 'Atendimentos realizados', v: n(data.totais.atendimentos), i: Tractor },
    { l: 'Produtores atendidos', v: n(data.totais.produtores_atendidos), i: Users },
    { l: 'Horas-máquina', v: n(data.totais.horas_maquina, 1), i: Clock },
    { l: 'Hectares trabalhados', v: n(data.totais.hectares, 1), i: MapIcon },
    { l: 'Pedidos em aberto hoje', v: n(data.em_aberto_hoje), i: Hourglass },
  ] : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center gap-3">
          <img src={logo} alt="" className="h-10 w-auto" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold leading-tight">Transparência — Secretaria de Agricultura</h1>
            <p className="text-xs text-muted-foreground">Prefeitura Municipal de Confresa/MT · atendimentos aos produtores rurais</p>
          </div>
          <Link to="/login" className="text-xs text-primary hover:underline shrink-0">Acesso da equipe</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">Dados do exercício selecionado, atualizados automaticamente pelo sistema.</p>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isError ? (
          <p className="text-sm text-destructive">Não foi possível carregar os dados agora. Tente novamente mais tarde.</p>
        ) : isLoading || !data ? (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : (
          <>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {cards.map((c) => (
                <div key={c.l} className="rounded-lg border bg-card p-3">
                  <c.i className="h-4 w-4 text-primary mb-1.5" />
                  <p className="text-2xl font-bold leading-none">{c.v}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{c.l}</p>
                </div>
              ))}
            </div>

            <section className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold mb-3">Atendimentos realizados por mês — {ano}</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porMes}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mes" fontSize={11} />
                    <YAxis allowDecimals={false} fontSize={11} width={32} />
                    <Tooltip formatter={(v: number) => [n(v), 'Atendimentos']} />
                    <Bar dataKey="atendimentos" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-lg border bg-card p-4">
                <h2 className="text-sm font-semibold mb-2">Por tipo de serviço</h2>
                <table className="w-full text-sm">
                  <tbody>
                    {data.por_tipo.map((t) => (
                      <tr key={t.tipo} className="border-t first:border-t-0">
                        <td className="py-1.5">{t.tipo}</td>
                        <td className="py-1.5 text-right tabular-nums font-medium">{n(t.atendimentos)}</td>
                      </tr>
                    ))}
                    {data.por_tipo.length === 0 && <tr><td className="py-2 text-muted-foreground">Sem atendimentos no ano.</td></tr>}
                  </tbody>
                </table>
              </section>
              <section className="rounded-lg border bg-card p-4">
                <h2 className="text-sm font-semibold mb-2">Por assentamento</h2>
                <table className="w-full text-sm">
                  <thead><tr className="text-[11px] text-muted-foreground text-left"><th className="font-medium pb-1">Assentamento</th><th className="font-medium pb-1 text-right">Atend.</th><th className="font-medium pb-1 text-right">Produtores</th><th className="font-medium pb-1 text-right">Horas</th></tr></thead>
                  <tbody>
                    {data.por_assentamento.map((a) => (
                      <tr key={a.assentamento} className="border-t">
                        <td className="py-1.5">{a.assentamento}</td>
                        <td className="py-1.5 text-right tabular-nums">{n(a.atendimentos)}</td>
                        <td className="py-1.5 text-right tabular-nums">{n(a.produtores)}</td>
                        <td className="py-1.5 text-right tabular-nums">{n(a.horas, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>

            <p className="text-[11px] text-muted-foreground flex gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Painel em conformidade com a Lei de Acesso à Informação (Lei 12.527/2011) e a LGPD (Lei 13.709/2018):
              somente números agregados, sem dados pessoais. Assentamentos com menos de 3 produtores atendidos no ano
              aparecem somados em "Outros".
            </p>
          </>
        )}
      </main>
    </div>
  );
}
