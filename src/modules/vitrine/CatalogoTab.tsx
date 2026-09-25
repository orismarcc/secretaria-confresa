import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SearchInput } from '@/components/SearchInput';
import { Plus, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { textIncludes } from '@/lib/text';
import { useProdutos, useVariedades, useSaveProduto, useSaveVariedade, type Produto } from './hooks';
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar produto ou variedade…" className="max-w-sm" />
        <Button size="sm" className="ml-auto" onClick={() => abrir(null)}><Plus className="h-4 w-4 mr-1" /> Produto</Button>
      </div>

      {porCategoria.map((c) => (
        <div key={c.value} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.label} <span className="font-bold">{c.itens.length}</span></h3>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {c.itens.map((p) => {
              const vars = variedades.filter((v) => v.produto_id === p.id);
              return (
                <Card key={p.id} className={cn(!p.ativo && 'opacity-60')}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="font-medium flex-1 truncate">{p.nome} <span className="text-[11px] text-muted-foreground">· {unidadeLabel(p.unidade_padrao)}</span></p>
                      <Switch checked={p.ativo} onCheckedChange={(on) => saveProduto.mutate({ id: p.id, ativo: on })} title={p.ativo ? 'Ativo' : 'Inativo'} />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => abrir(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                    </div>
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
                    <div className="flex gap-1">
                      <Input className="h-8 text-xs" placeholder="Nova variedade" value={novaVar[p.id] || ''}
                        onChange={(e) => setNovaVar((s) => ({ ...s, [p.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVariedade(p.id); } }} />
                      <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => addVariedade(p.id)}><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

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
