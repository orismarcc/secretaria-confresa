// Painel das associações: situação, regularidade, o que precisa de atenção
// (documentos vencendo/vencidos, mandatos) e uso dos maquinários cedidos.
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, CalendarClock, CheckCircle2, ClipboardCheck, FileWarning, Handshake, Plus, Tractor, Users,
} from 'lucide-react';
import { Contador, Revelar } from '@/lib/movimento';
import { useDemandTypes, useMachinery } from '@/hooks/useSupabaseData';
import { AnelRegularidade, Ajuda, SituacaoBadge, dataBR, fmtNum } from './comum';
import { GraficoMensal, KpisAtendimentos } from './AtendimentosAssociacao';
import {
  calcularMetricas, cessoesAtivas, situacaoMandato,
  type Associacao, type AtendimentoAssociacao, type Cessao, type Regularidade,
} from '@/lib/associacoes';

const fmtInt = (v: number) => Math.round(v).toLocaleString('pt-BR');

export function PrimeirosPassos({ onNova }: { onNova: () => void }) {
  const passos = [
    { t: 'Cadastre a associação', d: 'Nome, CNPJ, situação e diretoria. Só o nome é obrigatório.' },
    { t: 'Anexe os documentos', d: 'O checklist mostra o que falta e explica onde obter cada certidão.' },
    { t: 'Registre máquinas e atendimentos', d: 'Máquinas cedidas e os serviços feitos com os associados entram nas métricas.' },
  ];
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/10"><Handshake className="h-6 w-6 text-primary" /></div>
          <div>
            <p className="font-semibold text-lg">Comece por aqui</p>
            <p className="text-sm text-muted-foreground">Em três passos a Secretaria passa a acompanhar a regularidade de cada associação.</p>
          </div>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3">
          {passos.map((p, i) => (
            <li key={p.t} className="rounded-lg border bg-background p-3">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">{i + 1}</span>
              <p className="font-medium mt-2">{p.t}</p>
              <p className="text-xs text-muted-foreground">{p.d}</p>
            </li>
          ))}
        </ol>
        <Button onClick={onNova} className="gap-2"><Plus className="h-4 w-4" /> Cadastrar a primeira associação</Button>
      </CardContent>
    </Card>
  );
}

export function PainelAssociacoes({ associacoes, regularidades, cessoes, atendimentos, onAbrir, onNova }: {
  associacoes: Associacao[];
  regularidades: Map<string, Regularidade>;
  cessoes: Cessao[];
  atendimentos: AtendimentoAssociacao[];
  onAbrir: (id: string) => void;
  onNova: () => void;
}) {
  const { data: maquinas = [] } = useMachinery();
  const { data: tipos = [] } = useDemandTypes();
  const porSituacao = (s: string) => associacoes.filter((a) => a.situacao === s).length;
  const regulares = associacoes.filter((a) => regularidades.get(a.id)?.regular).length;
  const media = associacoes.length ? Math.round(associacoes.reduce((t, a) => t + (regularidades.get(a.id)?.percentual ?? 0), 0) / associacoes.length) : 0;

  // O que precisa de atenção (mais urgente primeiro).
  const atencao = useMemo(() => {
    const l: { id: string; assoc: Associacao; texto: string; nivel: 0 | 1 | 2 }[] = [];
    associacoes.forEach((a) => {
      const r = regularidades.get(a.id);
      r?.pendencias.forEach((p) => l.push({
        id: `${a.id}-${p.item.id}`, assoc: a, nivel: p.status === 'vencido' ? 0 : 1,
        texto: `${p.item.nome}: ${p.status === 'vencido' ? `vencido em ${dataBR(p.documento?.data_validade)}` : p.status === 'sem_validade' ? 'falta informar a validade' : 'pendente'}`,
      }));
      r?.vencendo.forEach((p) => l.push({ id: `${a.id}-${p.item.id}-v`, assoc: a, nivel: 2, texto: `${p.item.nome}: vence em ${p.diasParaVencer} dia(s)` }));
      const m = situacaoMandato(a.mandato_fim);
      if (m === 'vencido') l.push({ id: `${a.id}-mand`, assoc: a, nivel: 0, texto: `Mandato da diretoria venceu em ${dataBR(a.mandato_fim)}` });
      if (m === 'vencendo') l.push({ id: `${a.id}-mand`, assoc: a, nivel: 2, texto: `Mandato da diretoria termina em ${dataBR(a.mandato_fim)}` });
    });
    return l.sort((x, y) => x.nivel - y.nivel);
  }, [associacoes, regularidades]);

  const ativasCessoes = cessoesAtivas(cessoes);
  const metricas = useMemo(() => calcularMetricas(atendimentos), [atendimentos]);
  const nomeAssoc = (id: string) => associacoes.find((a) => a.id === id)?.sigla || associacoes.find((a) => a.id === id)?.nome || '—';
  const nomeMaq = (id: string) => (maquinas as { id: string; name: string }[]).find((m) => m.id === id)?.name ?? 'Máquina removida';
  const nomeTipo = (id: string) => (tipos as { id: string; name: string }[]).find((t) => t.id === id)?.name ?? '—';

  if (!associacoes.length) return <PrimeirosPassos onNova={onNova} />;

  return (
    <div className="space-y-4">
      <Revelar>
        <Card className="overflow-hidden bg-gradient-to-br from-primary/10 via-emerald-500/5 to-background border-primary/20">
          <CardContent className="p-4 sm:p-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-primary to-emerald-600 shadow-lg shadow-primary/30 shrink-0"><Handshake className="h-7 w-7 text-white" /></div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">Associações cadastradas</p>
                <p className="text-4xl sm:text-5xl font-black tabular-nums"><Contador valor={associacoes.length} formatar={fmtInt} /></p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <SituacaoBadge situacao="ativa" className="text-[11px]" /><span className="text-xs font-semibold -ml-1 mr-1">{porSituacao('ativa')}</span>
                  <SituacaoBadge situacao="em_regularizacao" className="text-[11px]" /><span className="text-xs font-semibold -ml-1 mr-1">{porSituacao('em_regularizacao')}</span>
                  <SituacaoBadge situacao="inativa" className="text-[11px]" /><span className="text-xs font-semibold -ml-1">{porSituacao('inativa')}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <AnelRegularidade percentual={media} regular={regulares === associacoes.length} tamanho={88} rotulo={false} />
              <div className="text-sm">
                <p className="font-semibold flex items-center gap-1.5">Regularidade média <Ajuda>Média do % de itens obrigatórios em dia no checklist de cada associação.</Ajuda></p>
                <p className="text-success flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> {regulares} regular(es)</p>
                <p className="text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> {associacoes.length - regulares} com pendências</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </Revelar>

      <div className="grid gap-4 lg:grid-cols-2">
        <Revelar atraso={60}>
          <Card className="h-full">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileWarning className="h-4 w-4 text-amber-500" /> Precisa de atenção <span className="text-muted-foreground font-normal text-sm">({atencao.length})</span></CardTitle></CardHeader>
            <CardContent>
              {atencao.length === 0 ? (
                <p className="text-sm text-success flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Nada pendente. Todos os documentos obrigatórios estão em dia.</p>
              ) : (
                <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {atencao.slice(0, 40).map((x) => (
                    <li key={x.id}>
                      <button type="button" onClick={() => onAbrir(x.assoc.id)} className="w-full text-left flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
                        <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${x.nivel === 0 ? 'bg-red-500' : x.nivel === 1 ? 'bg-orange-500' : 'bg-amber-400'}`} aria-hidden />
                        <span className="min-w-0 text-sm"><strong>{x.assoc.sigla || x.assoc.nome}</strong> — {x.texto}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </Revelar>
        <Revelar atraso={120}>
          <Card className="h-full">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-primary" /> Regularidade por associação</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {[...associacoes].sort((a, b) => (regularidades.get(a.id)?.percentual ?? 0) - (regularidades.get(b.id)?.percentual ?? 0)).map((a) => {
                  const r = regularidades.get(a.id);
                  const pct = r?.percentual ?? 0;
                  return (
                    <li key={a.id}>
                      <button type="button" onClick={() => onAbrir(a.id)} className="w-full text-left rounded-md px-2 py-1.5 hover:bg-muted/50">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate font-medium">{a.nome}</span>
                          <span className="tabular-nums font-semibold shrink-0">{pct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: r?.regular ? '#16a34a' : pct >= 70 ? '#d97706' : '#dc2626' }} />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </Revelar>
      </div>

      <Revelar atraso={180}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Tractor className="h-4 w-4 text-primary" /> Uso dos maquinários pelas associações
              <Ajuda>Somatório dos atendimentos lançados pelas associações. {ativasCessoes.length} máquina(s) cedida(s) no momento.</Ajuda>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <KpisAtendimentos lista={atendimentos} />
            {atendimentos.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2"><p className="text-sm font-medium mb-1">Horas por mês</p><GraficoMensal lista={atendimentos} /></div>
                <div className="space-y-3">
                  {[
                    { t: 'Por associação', l: metricas.porAssociacao.slice(0, 5).map((x) => ({ k: x.chave, n: nomeAssoc(x.chave), h: x.horas })) },
                    { t: 'Por máquina', l: metricas.porMaquina.slice(0, 5).map((x) => ({ k: x.chave || 'sem', n: x.chave ? nomeMaq(x.chave) : 'Não informada', h: x.horas })) },
                    { t: 'Por serviço', l: metricas.porTipo.slice(0, 5).map((x) => ({ k: x.chave, n: nomeTipo(x.chave), h: x.horas })) },
                  ].map((g) => (
                    <div key={g.t}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{g.t}</p>
                      <ul className="text-sm">{g.l.map((x) => <li key={x.k} className="flex justify-between gap-2"><span className="truncate">{x.n}</span><span className="tabular-nums shrink-0">{fmtNum(x.h)} h</span></li>)}</ul>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Users className="h-4 w-4" /> Nenhum atendimento lançado pelas associações ainda — registre na aba "Atendimentos" de cada associação.</p>
            )}
          </CardContent>
        </Card>
      </Revelar>

      {associacoes.some((a) => situacaoMandato(a.mandato_fim) === 'sem_data') && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Dica: informe o fim do mandato da diretoria no cadastro de cada associação para receber o aviso antes de vencer.</p>
      )}
    </div>
  );
}
