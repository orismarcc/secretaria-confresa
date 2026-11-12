// Ofícios cadastrados: pesquisa, filtros (período, categoria, situação, ano),
// ordenação e paginação. Tabela no computador, cards no celular.
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchInput } from '@/components/SearchInput';
import {
  ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, FileCheck2, FilePlus2, FileWarning, FilterX, SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SituacaoBadge } from './comum';
import {
  CATEGORIAS_OFICIO, FILTROS_VAZIOS, SITUACOES_OFICIO, dataBR, filtrarOficios, numeroCompleto, ordenarOficios, paginar,
  type CampoOrdem, type FiltrosOficio, type Oficio,
} from '@/lib/oficios';

const POR_PAGINA = 15;
const selectCls = 'w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

export function ListaOficios({ oficios, carregando, onAbrir, onNovo, podeCriar }: {
  oficios: Oficio[];
  carregando: boolean;
  onAbrir: (o: Oficio) => void;
  onNovo: () => void;
  podeCriar: boolean;
}) {
  const [filtros, setFiltros] = useState<FiltrosOficio>(FILTROS_VAZIOS);
  const [ordem, setOrdem] = useState<{ campo: CampoOrdem; dir: 'asc' | 'desc' }>({ campo: 'numero', dir: 'desc' });
  const [pagina, setPagina] = useState(1);
  const [verFiltros, setVerFiltros] = useState(false);

  const anos = useMemo(() => Array.from(new Set(oficios.map((o) => o.ano))).sort((a, b) => b - a), [oficios]);
  const categorias = useMemo(() => Array.from(new Set([...CATEGORIAS_OFICIO, ...oficios.map((o) => o.categoria)])), [oficios]);
  const filtrados = useMemo(() => ordenarOficios(filtrarOficios(oficios, filtros), ordem.campo, ordem.dir), [oficios, filtros, ordem]);
  const pag = paginar(filtrados, pagina, POR_PAGINA);
  useEffect(() => { setPagina(1); }, [filtros, ordem]);

  const set = (k: keyof FiltrosOficio, v: string) => setFiltros((f) => ({ ...f, [k]: v }));
  const filtrosAtivos = (['categoria', 'situacao', 'ano', 'de', 'ate'] as const).filter((k) => filtros[k]).length;
  const ordenarPor = (campo: CampoOrdem) =>
    setOrdem((o) => (o.campo === campo ? { campo, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: campo === 'assunto' || campo === 'destinatario' ? 'asc' : 'desc' }));

  const Cab = ({ campo, children, className }: { campo: CampoOrdem; children: React.ReactNode; className?: string }) => {
    const ativo = ordem.campo === campo;
    const Ic = !ativo ? ArrowUpDown : ordem.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th className={cn('px-3 py-2 text-left font-medium', className)} aria-sort={ativo ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button type="button" onClick={() => ordenarPor(campo)} className={cn('inline-flex items-center gap-1 hover:text-foreground', ativo ? 'text-foreground' : 'text-muted-foreground')}>
          {children} <Ic className="h-3.5 w-3.5" />
        </button>
      </th>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <SearchInput value={filtros.busca} onChange={(v) => set('busca', v)} placeholder="Número (473 ou 473/2026), ano, assunto ou destinatário" className="flex-1" />
            <div className="flex gap-2">
              <Button variant={verFiltros || filtrosAtivos ? 'secondary' : 'outline'} onClick={() => setVerFiltros((v) => !v)} className="gap-2 flex-1 sm:flex-none">
                <SlidersHorizontal className="h-4 w-4" /> Filtros{filtrosAtivos ? ` (${filtrosAtivos})` : ''}
              </Button>
              {podeCriar && (
                <Button onClick={onNovo} className="gap-2 flex-1 sm:flex-none"><FilePlus2 className="h-4 w-4" /> Novo</Button>
              )}
            </div>
          </div>
          {verFiltros && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
              <div className="space-y-1">
                <Label htmlFor="f-de" className="text-xs">De</Label>
                <Input id="f-de" type="date" value={filtros.de} onChange={(e) => set('de', e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="f-ate" className="text-xs">Até</Label>
                <Input id="f-ate" type="date" value={filtros.ate} onChange={(e) => set('ate', e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="f-cat" className="text-xs">Categoria</Label>
                <select id="f-cat" value={filtros.categoria} onChange={(e) => set('categoria', e.target.value)} className={selectCls}>
                  <option value="">Todas</option>
                  {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="f-sit" className="text-xs">Situação</Label>
                <select id="f-sit" value={filtros.situacao} onChange={(e) => set('situacao', e.target.value)} className={selectCls}>
                  <option value="">Todas</option>
                  {SITUACOES_OFICIO.map((s) => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
                </select>
              </div>
              <div className="space-y-1 col-span-2 lg:col-span-1">
                <Label htmlFor="f-ano" className="text-xs">Ano</Label>
                <select id="f-ano" value={filtros.ano} onChange={(e) => set('ano', e.target.value)} className={selectCls}>
                  <option value="">Todos</option>
                  {anos.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{filtrados.length} de {oficios.length} ofício(s)</span>
            {(filtrosAtivos > 0 || filtros.busca) && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setFiltros(FILTROS_VAZIOS)}>
                <FilterX className="h-3.5 w-3.5" /> Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {carregando ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : filtrados.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          {oficios.length === 0 ? 'Nenhum ofício cadastrado ainda.' : 'Nenhum ofício encontrado com esses filtros.'}
        </CardContent></Card>
      ) : (
        <>
          {/* Computador: tabela */}
          <Card className="hidden md:block overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <Cab campo="numero" className="w-28">Número</Cab>
                  <Cab campo="data" className="w-28">Data</Cab>
                  <Cab campo="assunto">Assunto</Cab>
                  <Cab campo="destinatario">Destinatário</Cab>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Categoria</th>
                  <Cab campo="situacao" className="w-32">Situação</Cab>
                  <th className="px-3 py-2 w-12 text-center font-medium text-muted-foreground">PDF</th>
                </tr>
              </thead>
              <tbody>
                {pag.itens.map((o) => (
                  <tr key={o.id} onClick={() => onAbrir(o)} className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                    tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onAbrir(o); }}>
                    <td className="px-3 py-2.5 font-bold tabular-nums">{numeroCompleto(o)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{dataBR(o.data_oficio)}</td>
                    <td className="px-3 py-2.5 max-w-[280px]"><span className="line-clamp-2">{o.assunto}</span></td>
                    <td className="px-3 py-2.5 max-w-[220px] text-muted-foreground"><span className="line-clamp-2">{o.destinatario}</span></td>
                    <td className="px-3 py-2.5 text-muted-foreground">{o.categoria}</td>
                    <td className="px-3 py-2.5"><SituacaoBadge situacao={o.situacao} /></td>
                    <td className="px-3 py-2.5 text-center">
                      {o.arquivo_path
                        ? <FileCheck2 className="h-4 w-4 text-success inline" aria-label="Com PDF assinado" />
                        : <FileWarning className="h-4 w-4 text-amber-500 inline" aria-label="Sem PDF assinado" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Celular: cards */}
          <div className="md:hidden space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="ordem-m" className="text-xs text-muted-foreground shrink-0">Ordenar</Label>
              <select id="ordem-m" value={`${ordem.campo}:${ordem.dir}`} onChange={(e) => {
                const [campo, dir] = e.target.value.split(':') as [CampoOrdem, 'asc' | 'desc'];
                setOrdem({ campo, dir });
              }} className={selectCls}>
                <option value="numero:desc">Número (mais novo)</option>
                <option value="numero:asc">Número (mais antigo)</option>
                <option value="data:desc">Data (mais recente)</option>
                <option value="data:asc">Data (mais antiga)</option>
                <option value="assunto:asc">Assunto (A–Z)</option>
                <option value="destinatario:asc">Destinatário (A–Z)</option>
              </select>
            </div>
            {pag.itens.map((o) => (
              <button key={o.id} type="button" onClick={() => onAbrir(o)} className="w-full text-left rounded-lg border bg-card p-3 hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold tabular-nums">{numeroCompleto(o)}</span>
                  <span className="flex items-center gap-1.5">
                    {o.arquivo_path ? <FileCheck2 className="h-4 w-4 text-success" /> : <FileWarning className="h-4 w-4 text-amber-500" />}
                    <SituacaoBadge situacao={o.situacao} />
                  </span>
                </div>
                <p className="text-sm mt-1 line-clamp-2">{o.assunto}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{o.destinatario}</p>
                <p className="text-xs text-muted-foreground">{dataBR(o.data_oficio)} · {o.categoria}</p>
              </button>
            ))}
          </div>

          {pag.paginas > 1 && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Página {pag.pagina} de {pag.paginas}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPagina(pag.pagina - 1)} disabled={pag.pagina <= 1} aria-label="Página anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPagina(pag.pagina + 1)} disabled={pag.pagina >= pag.paginas} aria-label="Próxima página">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
