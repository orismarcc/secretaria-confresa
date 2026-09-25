import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SearchInput } from '@/components/SearchInput';
import { Plus, Pencil, X, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { textIncludes } from '@/lib/text';
import { useProdutos, useVariedades, useOfertas, useSaveProduto, useSaveVariedade, type Produto } from './hooks';
import { CATEGORIAS, UNIDADES, unidadeLabel } from './constants';

/**
 * Catálogo padronizado. Não há "excluir": produto/variedade em uso por ofertas
 * é apenas DESATIVADO (some das novas ofertas; as existentes continuam).
 */
export function CatalogoTab() {
  const { data: produtos = [] } = useProdutos();
  const { data: variedades = [] } = useVariedades();
  const saveProduto = useSaveProduto();
  const saveVariedade = useSaveVariedade();

  const [busca, setBusca] = useState('');
  const [form, setForm] = useState<{ open: boolean; p: Produto | null }>({ open: false, p: null });
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('hortalica');
  const [unidade, setUnidade] = useState('kg');
  const [novaVar, setNovaVar] = useState<Record<string, string>>({});
  // Tudo recolhido por padrão: categorias e produtos abrem sob demanda.
  // Com busca preenchida, as categorias com resultado abrem sozinhas.
  const [catAbertas, setCatAbertas] = useState<Set<string>>(new Set());
  const [prodAbertos, setProdAbertos] = useState<Set<string>>(new Set());
  const { data: ofertas = [] } = useOfertas();
  const ofertasPorProduto = useMemo(() => {
    const m: Record<string, number> = {};
    ofertas.forEach((o) => { if (o.ativo && o.situacao !== 'suspensa') m[o.produto_id] = (m[o.produto_id] || 0) + 1; });
    return m;
  }, [ofertas]);
  const alternar = (set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    set((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const abrir = (p: Produto | null) => {
    setForm({ open: true, p });
    setNome(p?.nome ?? ''); setCategoria(p?.categoria ?? 'hortalica'); setUnidade(p?.unidade_padrao ?? 'kg');
  };
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    await saveProduto.mutateAsync({ id: form.p?.id, nome: nome.trim(), categoria, unidade_padrao: unidade });
    setForm({ open: false, p: null });
  };
  const addVariedade = async (produtoId: string) => {
    const n = (novaVar[produtoId] || '').trim();
    if (!n) return;
    await saveVariedade.mutateAsync({ produto_id: produtoId, nome: n });
    setNovaVar((s) => ({ ...s, [produtoId]: '' }));
  };

  const porCategoria = useMemo(() => CATEGORIAS.map((c) => ({
    ...c,
    itens: produtos.filter((p) => p.categoria === c.value && (!busca || textIncludes(p.nome, busca)
      || variedades.some((v) => v.produto_id === p.id && textIncludes(v.nome, busca)))),
  })).filter((c) => c.itens.length > 0), [produtos, variedades, busca]);
  const tudoAberto = porCategoria.length > 0 && porCategoria.every((c) => catAbertas.has(c.value));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar produto ou variedade…" className="max-w-sm" />
        <div className="ml-auto flex gap-2">
          {tudoAberto ? (
            <Button variant="outline" size="sm" onClick={() => { setCatAbertas(new Set()); setProdAbertos(new Set()); }}><ChevronsDownUp className="h-4 w-4 mr-1" /> Recolher tudo</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setCatAbertas(new Set(porCategoria.map((c) => c.value)))}><ChevronsUpDown className="h-4 w-4 mr-1" /> Abrir categorias</Button>
          )}
          <Button size="sm" onClick={() => abrir(null)}><Plus className="h-4 w-4 mr-1" /> Produto</Button>
        </div>
      </div>

      {porCategoria.map((c) => {
        const catAberta = !!busca || catAbertas.has(c.value);
        const nVars = c.itens.reduce((n, p) => n + variedades.filter((v) => v.produto_id === p.id).length, 0);
        return (
          <div key={c.value} className="rounded-lg border">
            <button type="button" onClick={() => alternar(setCatAbertas, c.value)} aria-expanded={catAberta}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40 rounded-lg">
              <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', catAberta && 'rotate-90')} />
              <span className="font-semibold text-sm flex-1">{c.label}</span>
              <span className="text-[11px] text-muted-foreground">{c.itens.length} produto(s) · {nVars} variedade(s)</span>
            </button>
            {catAberta && (
              <div className="grid gap-1.5 p-2 pt-0 sm:grid-cols-2 xl:grid-cols-3 items-start">
                {c.itens.map((p) => {
                  const vars = variedades.filter((v) => v.produto_id === p.id);
                  const aberto = prodAbertos.has(p.id);
                  const nOf = ofertasPorProduto[p.id] || 0;
                  return (
                    <div key={p.id} className={cn('rounded-md border bg-card', !p.ativo && 'opacity-60', aberto && 'ring-1 ring-primary/40')}>
                      <div className="flex items-center gap-1.5 px-2 py-1.5">
                        <button type="button" onClick={() => alternar(setProdAbertos, p.id)} aria-expanded={aberto}
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                          <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', aberto && 'rotate-90')} />
                          <span className="truncate text-sm font-medium">{p.nome}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">· {unidadeLabel(p.unidade_padrao)}</span>
                        </button>
                        <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground" title="Variedades cadastradas">{vars.length} var.</span>
                        {nOf > 0 && <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary" title="Ofertas ativas deste produto">{nOf} of.</span>}
                        <Switch checked={p.ativo} onCheckedChange={(on) => saveProduto.mutate({ id: p.id, ativo: on })} title={p.ativo ? 'Ativo' : 'Inativo'} className="scale-75" />
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => abrir(p)} title="Editar produto"><Pencil className="h-3.5 w-3.5" /></Button>
                      </div>
                      {aberto && (
                        <div className="space-y-2 border-t px-2 py-2">
                          {vars.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {vars.map((v) => (
                                <span key={v.id} className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs', !v.ativo && 'line-through opacity-60')}>
                                  {v.nome}
                                  <button type="button" title={v.ativo ? 'Desativar' : 'Reativar'} onClick={() => saveVariedade.mutate({ id: v.id, ativo: !v.ativo })}>
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : <p className="text-[11px] text-muted-foreground">Sem variedades — as ofertas usam só o produto.</p>}
                          <div className="flex gap-1">
                            <Input className="h-8 text-xs" placeholder="Nova variedade" value={novaVar[p.id] || ''}
                              onChange={(e) => setNovaVar((s) => ({ ...s, [p.id]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVariedade(p.id); } }} />
                            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => addVariedade(p.id)}><Plus className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {porCategoria.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum produto encontrado.</p>}

      <Dialog open={form.open} onOpenChange={(o) => setForm((s) => ({ ...s, open: o }))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{form.p ? 'Editar produto' : 'Novo produto'}</DialogTitle>
            <DialogDescription>Itens do catálogo padronizado da vitrine.</DialogDescription>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-3">
            <div className="space-y-1.5"><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Unidade padrão</Label>
                <Select value={unidade} onValueChange={setUnidade}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNIDADES.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setForm({ open: false, p: null })}>Cancelar</Button>
              <Button type="submit" disabled={saveProduto.isPending || !nome.trim()}>Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
