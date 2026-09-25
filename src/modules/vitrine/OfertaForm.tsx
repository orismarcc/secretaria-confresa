import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Loader2, AlertTriangle, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProdutos, useVariedades, useSaveOferta, type Oferta } from './hooks';
import { CATEGORIAS, UNIDADES, FORMAS, FREQUENCIAS, PRECO_INCLUI, unidadeLabel } from './constants';
import { MesesPicker } from './Meses';

const NONE = '__none__';
const TRI = [{ v: NONE, l: '—' }, { v: 'sim', l: 'Sim' }, { v: 'nao', l: 'Não' }];
const toTri = (b: boolean | null | undefined) => (b == null ? NONE : b ? 'sim' : 'nao');
const fromTri = (s: string) => (s === NONE ? null : s === 'sim');
const toNum = (s: string) => { const n = Number(String(s).replace(',', '.')); return s.trim() === '' || !Number.isFinite(n) ? null : n; };

const empty = {
  produto_id: '', variedade_id: NONE, unidade: 'kg', qtd_mensal: '', capacidade_mensal: '',
  meses: [] as number[], forma: NONE, embalagem: '', preco: '', preco_entregue: false,
  preco_inclui: [] as string[], frequencia: NONE, entrega_propria: NONE, emite_nota: NONE,
  validade_dias: '', registro_sanitario: '', observacao: '', ativo: true,
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fornecedorId: string;
  oferta?: Oferta | null;
  /** Ofertas do fornecedor — para avisar de repetição do mesmo produto/variedade. */
  ofertasDoFornecedor?: Oferta[];
  /** Abrir a oferta existente para edição (mantém o histórico de preço). */
  onEditarExistente?: (o: Oferta) => void;
}

export function OfertaForm({ open, onOpenChange, fornecedorId, oferta, ofertasDoFornecedor = [], onEditarExistente }: Props) {
  const { data: produtos = [] } = useProdutos();
  const { data: variedades = [] } = useVariedades();
  const save = useSaveOferta();
  const [f, setF] = useState(empty);
  const [pickOpen, setPickOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(oferta ? {
      produto_id: oferta.produto_id, variedade_id: oferta.variedade_id || NONE, unidade: oferta.unidade,
      qtd_mensal: oferta.qtd_mensal?.toString() ?? '', capacidade_mensal: oferta.capacidade_mensal?.toString() ?? '',
      meses: oferta.meses || [], forma: oferta.forma || NONE, embalagem: oferta.embalagem || '',
      preco: oferta.preco?.toString() ?? '', preco_entregue: oferta.preco_entregue, preco_inclui: oferta.preco_inclui || [],
      frequencia: oferta.frequencia || NONE, entrega_propria: toTri(oferta.entrega_propria), emite_nota: toTri(oferta.emite_nota),
      validade_dias: oferta.validade_dias?.toString() ?? '', registro_sanitario: oferta.registro_sanitario || '',
      observacao: oferta.observacao || '', ativo: oferta.ativo,
    } : empty);
  }, [open, oferta]);

  const produto = produtos.find((p) => p.id === f.produto_id);
  const vars = useMemo(() => variedades.filter((v) => v.produto_id === f.produto_id && v.ativo), [variedades, f.produto_id]);
  const ativos = produtos.filter((p) => p.ativo || p.id === f.produto_id);
  const precisaSanitario = produto?.categoria === 'processado' || produto?.categoria === 'origem_animal';
  // Nova oferta de produto/variedade que o fornecedor JÁ tem: o certo é atualizar a existente.
  const existente = !oferta && f.produto_id
    ? ofertasDoFornecedor.find((o) => o.produto_id === f.produto_id && (o.variedade_id ?? null) === (f.variedade_id === NONE ? null : f.variedade_id))
    : undefined;

  const escolherProduto = (id: string) => {
    const p = produtos.find((x) => x.id === id);
    // Unidade padrão do produto só quando ainda não foi mexida (oferta nova).
    setF((s) => ({ ...s, produto_id: id, variedade_id: NONE, unidade: !oferta ? (p?.unidade_padrao || s.unidade) : s.unidade }));
    setPickOpen(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.produto_id) return;
    await save.mutateAsync({
      id: oferta?.id,
      fornecedor_id: fornecedorId,
      produto_id: f.produto_id,
      variedade_id: f.variedade_id === NONE ? null : f.variedade_id,
      unidade: f.unidade,
      qtd_mensal: toNum(f.qtd_mensal),
      capacidade_mensal: toNum(f.capacidade_mensal),
      meses: f.meses,
      forma: f.forma === NONE ? null : f.forma,
      embalagem: f.embalagem.trim() || null,
      preco: toNum(f.preco),
      preco_entregue: f.preco_entregue,
      preco_inclui: f.preco_inclui,
      frequencia: f.frequencia === NONE ? null : f.frequencia,
      entrega_propria: fromTri(f.entrega_propria),
      emite_nota: fromTri(f.emite_nota),
      validade_dias: precisaSanitario ? (toNum(f.validade_dias) as number | null) : null,
      registro_sanitario: precisaSanitario ? (f.registro_sanitario.trim() || null) : null,
      observacao: f.observacao.trim() || null,
      ativo: f.ativo,
    });
    onOpenChange(false);
  };

  const un = unidadeLabel(f.unidade);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{oferta ? 'Editar oferta' : 'Nova oferta'}</DialogTitle>
          <DialogDescription>O que o produtor tem para fornecer, quanto, quando e por qual preço.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Produto *</Label>
              <Popover open={pickOpen} onOpenChange={setPickOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between font-normal">
                    <span className="truncate">{produto?.nome || 'Selecione'}</span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[240px]" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar produto…" />
                    <CommandList>
                      <CommandEmpty>Não está no catálogo — inclua na aba Catálogo.</CommandEmpty>
                      {CATEGORIAS.map((c) => {
                        const itens = ativos.filter((p) => p.categoria === c.value);
                        if (itens.length === 0) return null;
                        return (
                          <CommandGroup key={c.value} heading={c.label}>
                            {itens.map((p) => (
                              <CommandItem key={p.id} value={`${p.nome} ${c.label}`} onSelect={() => escolherProduto(p.id)}>
                                <Check className={cn('mr-2 h-4 w-4', f.produto_id === p.id ? 'opacity-100' : 'opacity-0')} />
                                {p.nome}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        );
                      })}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Variedade</Label>
              <Select value={f.variedade_id} onValueChange={(v) => setF((s) => ({ ...s, variedade_id: v }))} disabled={!f.produto_id || vars.length === 0}>
                <SelectTrigger><SelectValue placeholder={vars.length === 0 ? 'Sem variedades' : 'Selecione'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Não informada</SelectItem>
                  {vars.map((v) => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {existente && (
            <div className="rounded-md border border-amber-400/60 bg-amber-500/10 p-3 text-sm space-y-2">
              <p className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Este fornecedor já tem oferta de <strong>{produto?.nome}{existente.vitrine_variedades?.nome ? ` ${existente.vitrine_variedades.nome}` : ''}</strong>. Para mudar preço, quantidade ou meses, atualize a existente — assim o preço anterior fica no histórico.</span>
              </p>
              {onEditarExistente && (
                <Button type="button" size="sm" variant="outline" onClick={() => onEditarExistente(existente)}>
                  Atualizar a oferta existente
                </Button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quanto pode vender por mês</Label>
              <Input inputMode="decimal" value={f.qtd_mensal} onChange={(e) => setF((s) => ({ ...s, qtd_mensal: e.target.value }))} placeholder="Ex.: 500" />
            </div>
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Select value={f.unidade} onValueChange={(v) => setF((s) => ({ ...s, unidade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNIDADES.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Meses em que tem para vender</Label>
            <MesesPicker value={f.meses} onChange={(v) => setF((s) => ({ ...s, meses: v }))} />
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Preço (R$ por {un})</Label>
              <Input inputMode="decimal" value={f.preco} onChange={(e) => setF((s) => ({ ...s, preco: e.target.value }))} placeholder="Ex.: 3,50" />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 h-10">
              <Label htmlFor="vo-entregue" className="text-sm cursor-pointer">Preço já com entrega</Label>
              <Switch id="vo-entregue" checked={f.preco_entregue} onCheckedChange={(c) => setF((s) => ({ ...s, preco_entregue: c }))} />
            </div>
          </div>
          {oferta && (
            <p className="-mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <History className="h-3.5 w-3.5" /> Ao mudar o preço, o valor anterior fica guardado no histórico desta oferta.
            </p>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Frequência</Label>
              <Select value={f.frequencia} onValueChange={(v) => setF((s) => ({ ...s, frequencia: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {FREQUENCIAS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Entrega própria</Label>
              <Select value={f.entrega_propria} onValueChange={(v) => setF((s) => ({ ...s, entrega_propria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TRI.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Emite nota</Label>
              <Select value={f.emite_nota} onValueChange={(v) => setF((s) => ({ ...s, emite_nota: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TRI.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-medium">Mais detalhes (opcional)</summary>
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Capacidade de produção/mês</Label>
                  <Input inputMode="decimal" value={f.capacidade_mensal} onChange={(e) => setF((s) => ({ ...s, capacidade_mensal: e.target.value }))} placeholder={`em ${un}`} />
                </div>
                <div className="space-y-1.5">
                  <Label>Forma</Label>
                  <Select value={f.forma} onValueChange={(v) => setF((s) => ({ ...s, forma: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {FORMAS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5"><Label>Embalagem</Label><Input value={f.embalagem} onChange={(e) => setF((s) => ({ ...s, embalagem: e.target.value }))} placeholder="Ex.: caixa de 20 kg, bandeja" /></div>
              <div className="space-y-1.5">
                <Label>O preço inclui</Label>
                <div className="flex flex-wrap gap-1.5">
                  {PRECO_INCLUI.map((o) => {
                    const on = f.preco_inclui.includes(o.value);
                    return (
                      <button key={o.value} type="button" aria-pressed={on}
                        onClick={() => setF((s) => ({ ...s, preco_inclui: on ? s.preco_inclui.filter((x) => x !== o.value) : [...s.preco_inclui, o.value] }))}
                        className={cn('rounded-full border px-2.5 py-1 text-xs', on ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted')}>
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {precisaSanitario && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Validade (dias)</Label><Input inputMode="numeric" value={f.validade_dias} onChange={(e) => setF((s) => ({ ...s, validade_dias: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Registro/inspeção sanitária</Label><Input value={f.registro_sanitario} onChange={(e) => setF((s) => ({ ...s, registro_sanitario: e.target.value }))} placeholder="SIM, SIE, SIF…" /></div>
                </div>
              )}
              <div className="space-y-1.5"><Label>Observação</Label><Textarea rows={2} value={f.observacao} onChange={(e) => setF((s) => ({ ...s, observacao: e.target.value }))} /></div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label htmlFor="vo-ativo" className="cursor-pointer">Oferta ativa</Label>
                <Switch id="vo-ativo" checked={f.ativo} onCheckedChange={(c) => setF((s) => ({ ...s, ativo: c }))} />
              </div>
            </div>
          </details>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending || !f.produto_id}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {oferta ? 'Salvar' : 'Adicionar oferta'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
