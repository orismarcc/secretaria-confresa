// Painel: contador animado do total, indicadores por ano, situação e
// categoria. Cada indicador expande e mostra os números dos ofícios;
// clicar num número abre o ofício.
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarRange, ChevronDown, FileCheck2, FilePlus2, FileStack, FileWarning, Layers, ListChecks,
} from 'lucide-react';
import { Contador, Revelar } from '@/lib/movimento';
import { cn } from '@/lib/utils';
import { SituacaoBadge } from './comum';
import {
  calcularIndicadores, dataBR, numeroCompleto, ordenarOficios, situacaoInfo,
  type GrupoIndicador, type Oficio,
} from '@/lib/oficios';

const fmtInt = (v: number) => Math.round(v).toLocaleString('pt-BR');

function Indicador({ titulo, icone: Icone, grupos, cor, total, onAbrir }: {
  titulo: string;
  icone: typeof Layers;
  grupos: GrupoIndicador[];
  cor: (g: GrupoIndicador) => string;
  total: number;
  onAbrir: (o: Oficio) => void;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Icone className="h-4 w-4 text-primary" /> {titulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {grupos.length === 0 && <p className="text-sm text-muted-foreground">Sem ofícios.</p>}
        {grupos.map((g) => {
          const exp = aberto === g.chave;
          const pct = total ? (g.oficios.length / total) * 100 : 0;
          return (
            <div key={g.chave} className="rounded-lg border">
              <button
                type="button"
                onClick={() => setAberto(exp ? null : g.chave)}
                aria-expanded={exp}
                className="w-full px-3 py-2 text-left hover:bg-muted/50 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{g.rotulo}</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className="text-sm font-bold tabular-nums">{g.oficios.length}</span>
                    <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', exp && 'rotate-180')} />
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: cor(g) }} />
                </div>
              </button>
              {exp && (
                <div className="px-3 pb-3 pt-1 flex flex-wrap gap-1.5">
                  {g.oficios.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => onAbrir(o)}
                      title={o.assunto}
                      className="rounded-md border bg-background px-2 py-1 text-xs font-semibold tabular-nums hover:border-primary hover:text-primary transition-colors"
                    >
                      {numeroCompleto(o)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

const CORES_CATEGORIA = ['#16a34a', '#2563eb', '#7c3aed', '#d97706', '#0891b2', '#db2777', '#65a30d', '#64748b'];

export function PainelOficios({ oficios, carregando, onAbrir, onNovo, podeCriar }: {
  oficios: Oficio[];
  carregando: boolean;
  onAbrir: (o: Oficio) => void;
  onNovo: () => void;
  podeCriar: boolean;
}) {
  const ind = useMemo(() => calcularIndicadores(oficios), [oficios]);
  const anoAtual = new Date().getFullYear();
  const doAno = ind.porAno.find((g) => g.chave === String(anoAtual))?.oficios.length ?? 0;
  const recentes = useMemo(() => ordenarOficios(oficios, 'data', 'desc').slice(0, 6), [oficios]);
  const corCategoria = (g: GrupoIndicador) => CORES_CATEGORIA[ind.porCategoria.findIndex((x) => x.chave === g.chave) % CORES_CATEGORIA.length];

  if (carregando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-56" /><Skeleton className="h-56" /><Skeleton className="h-56" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Revelar>
        <Card className="overflow-hidden bg-gradient-to-br from-primary/10 via-emerald-500/5 to-background border-primary/20">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-primary to-emerald-600 shadow-lg shadow-primary/30 shrink-0">
                  <FileStack className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">Ofícios cadastrados</p>
                  <p className="text-4xl sm:text-5xl font-black tabular-nums"><Contador valor={ind.total} formatar={fmtInt} /></p>
                  <p className="text-xs text-muted-foreground mt-0.5">{doAno} em {anoAtual}</p>
                </div>
              </div>
              {podeCriar && (
                <Button onClick={onNovo} className="gap-2 self-start sm:self-center">
                  <FilePlus2 className="h-4 w-4" /> Novo ofício
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
              <div className="rounded-lg border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><FileCheck2 className="h-3.5 w-3.5 text-success" /> Com PDF assinado</p>
                <p className="text-xl font-bold tabular-nums"><Contador valor={ind.comArquivo} formatar={fmtInt} /></p>
              </div>
              <div className="rounded-lg border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><FileWarning className="h-3.5 w-3.5 text-amber-500" /> Sem PDF assinado</p>
                <p className="text-xl font-bold tabular-nums"><Contador valor={ind.semArquivo} formatar={fmtInt} /></p>
              </div>
              <div className="rounded-lg border bg-background/60 p-3 col-span-2 sm:col-span-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Layers className="h-3.5 w-3.5 text-primary" /> Categorias em uso</p>
                <p className="text-xl font-bold tabular-nums"><Contador valor={ind.porCategoria.length} formatar={fmtInt} /></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </Revelar>

      <div className="grid gap-4 md:grid-cols-3">
        <Revelar atraso={60}>
          <Indicador titulo="Por ano" icone={CalendarRange} grupos={ind.porAno} total={ind.total} cor={() => '#16a34a'} onAbrir={onAbrir} />
        </Revelar>
        <Revelar atraso={120}>
          <Indicador titulo="Por situação" icone={ListChecks} grupos={ind.porSituacao} total={ind.total} cor={(g) => situacaoInfo(g.chave).cor} onAbrir={onAbrir} />
        </Revelar>
        <Revelar atraso={180}>
          <Indicador titulo="Por categoria" icone={Layers} grupos={ind.porCategoria} total={ind.total} cor={corCategoria} onAbrir={onAbrir} />
        </Revelar>
      </div>

      <Revelar atraso={240}>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Mais recentes</CardTitle></CardHeader>
          <CardContent>
            {recentes.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-muted-foreground">Nenhum ofício cadastrado ainda.</p>
                {podeCriar && <Button variant="outline" onClick={onNovo} className="gap-2"><FilePlus2 className="h-4 w-4" /> Cadastrar o primeiro</Button>}
              </div>
            ) : (
              <ul className="divide-y">
                {recentes.map((o) => (
                  <li key={o.id}>
                    <button type="button" onClick={() => onAbrir(o)} className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-muted/40 rounded-md px-2 transition-colors">
                      <span className="text-sm font-bold tabular-nums w-20 shrink-0">{numeroCompleto(o)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm truncate">{o.assunto}</span>
                        <span className="block text-xs text-muted-foreground truncate">{o.destinatario} · {dataBR(o.data_oficio)}</span>
                      </span>
                      {o.arquivo_path ? <FileCheck2 className="h-4 w-4 text-success shrink-0" aria-label="Com PDF" /> : <FileWarning className="h-4 w-4 text-amber-500 shrink-0" aria-label="Sem PDF" />}
                      <SituacaoBadge situacao={o.situacao} className="hidden sm:inline-flex" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </Revelar>
    </div>
  );
}
