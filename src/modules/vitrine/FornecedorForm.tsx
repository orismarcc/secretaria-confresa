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
import { Check, ChevronsUpDown, Link2, Loader2, X, Crosshair } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useProducers, useSettlements } from '@/hooks/useSupabaseData';
import { useSaveFornecedor, type Fornecedor } from './hooks';
import { PERFIS, PROGRAMAS, GENEROS, STATUS } from './constants';

const NONE = '__none__';

function Chips({ options, value, onChange }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const set = new Set(value);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = set.has(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => { const n = new Set(set); if (on) n.delete(o.value); else n.add(o.value); onChange([...n]); }}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs transition-colors',
              on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const empty = {
  producer_id: null as string | null, nome: '', telefone: '', whatsapp: '', email: '',
  settlement_id: NONE, localidade: '', data_nascimento: '', genero: NONE,
  perfis: [] as string[], programas: [] as string[], aceita_contato: true,
  status: 'em_analise', observacao_interna: '', latitude: '', longitude: '',
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fornecedor?: Fornecedor | null;
  /** ids de produtores rurais já vinculados a outro fornecedor. */
  linkedProducerIds: Set<string>;
  onSaved?: (id: string) => void;
}

export function FornecedorForm({ open, onOpenChange, fornecedor, linkedProducerIds, onSaved }: Props) {
  const { data: producers = [] } = useProducers();
  const { data: settlements = [] } = useSettlements();
  const save = useSaveFornecedor();
  const { toast } = useToast();
  const { getCurrentPosition, isLoading: gpsLoading } = useGeolocation();
  const [f, setF] = useState(empty);
  const [pickOpen, setPickOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(fornecedor ? {
      producer_id: fornecedor.producer_id, nome: fornecedor.nome, telefone: fornecedor.telefone || '',
      whatsapp: fornecedor.whatsapp || '', email: fornecedor.email || '',
      settlement_id: fornecedor.settlement_id || NONE, localidade: fornecedor.localidade || '',
      data_nascimento: (fornecedor.data_nascimento || '').slice(0, 10), genero: fornecedor.genero || NONE,
      perfis: fornecedor.perfis || [], programas: fornecedor.programas || [],
      aceita_contato: fornecedor.aceita_contato, status: fornecedor.status,
      observacao_interna: fornecedor.observacao_interna || '',
      latitude: fornecedor.latitude != null ? String(fornecedor.latitude) : '',
      longitude: fornecedor.longitude != null ? String(fornecedor.longitude) : '',
    } : empty);
  }, [open, fornecedor]);

  const linked = useMemo(
    () => (producers as any[]).find((p) => p.id === f.producer_id) || null,
    [producers, f.producer_id],
  );

  const vincular = (p: any) => {
    setF((s) => ({
      ...s,
      producer_id: p.id,
      nome: s.nome || p.name || '',
      telefone: s.telefone || p.phone || '',
      settlement_id: s.settlement_id !== NONE ? s.settlement_id : (p.settlement_id || NONE),
      localidade: s.localidade || p.location_name || '',
    }));
    setPickOpen(false);
  };

  const marcarLocalizacao = async () => {
    try {
      const { latitude, longitude } = await getCurrentPosition();
      setF((s) => ({ ...s, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) }));
      toast({ title: 'Localização marcada', description: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` });
    } catch (e: any) {
      toast({ title: 'Não foi possível obter a localização', description: e?.message, variant: 'destructive' });
    }
  };
  const coord = (v: string, min: number, max: number) => {
    const n = Number(v.replace(',', '.'));
    return v.trim() && Number.isFinite(n) && n >= min && n <= max ? n : null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.nome.trim()) return;
    const lat = coord(f.latitude, -90, 90);
    const lng = coord(f.longitude, -180, 180);
    // Coordenadas: as duas ou nenhuma (o banco também exige).
    if ((f.latitude.trim() || f.longitude.trim()) && (lat === null || lng === null)) {
      toast({ title: 'Coordenadas inválidas', description: 'Preencha latitude e longitude válidas, ou deixe as duas vazias.', variant: 'destructive' });
      return;
    }
    const id = await save.mutateAsync({
      id: fornecedor?.id,
      producer_id: f.producer_id,
      nome: f.nome.trim(),
      telefone: f.telefone.trim() || null,
      whatsapp: f.whatsapp.trim() || null,
      email: f.email.trim() || null,
      settlement_id: f.settlement_id === NONE ? null : f.settlement_id,
      localidade: f.localidade.trim() || null,
      data_nascimento: f.data_nascimento || null,
      genero: f.genero === NONE ? null : f.genero,
      perfis: f.perfis,
      programas: f.programas,
      aceita_contato: f.aceita_contato,
      status: f.status,
      observacao_interna: f.observacao_interna.trim() || null,
      latitude: lat,
      longitude: lng,
    });
    onOpenChange(false);
    onSaved?.(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{fornecedor ? 'Editar fornecedor' : 'Novo fornecedor'}</DialogTitle>
          <DialogDescription>Quem é o produtor. O que ele oferta é cadastrado depois, em "Ofertas".</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/* Vínculo com o cadastro rural */}
          <div className="rounded-lg border p-3 space-y-2">
            <Label className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Produtor já cadastrado no sistema (opcional)</Label>
            {linked ? (
              <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm">
                <span className="truncate">
                  {linked.name}
                  {linked.caf ? <span className="text-xs text-muted-foreground"> · CAF {linked.caf}</span> : null}
                </span>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setF((s) => ({ ...s, producer_id: null }))} title="Desvincular">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Popover open={pickOpen} onOpenChange={setPickOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between font-normal">
                    Buscar no cadastro rural…
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  <Command>
                    <CommandInput placeholder="Nome do produtor…" />
                    <CommandList>
                      <CommandEmpty>Nenhum produtor encontrado.</CommandEmpty>
                      <CommandGroup>
                        {(producers as any[]).map((p) => {
                          const taken = linkedProducerIds.has(p.id) && p.id !== fornecedor?.producer_id;
                          return (
                            <CommandItem key={p.id} value={`${p.name} ${p.id}`} disabled={taken} onSelect={() => !taken && vincular(p)}>
                              <Check className={cn('mr-2 h-4 w-4', f.producer_id === p.id ? 'opacity-100' : 'opacity-0')} />
                              <span className="truncate">{p.name}</span>
                              {taken && <span className="ml-auto text-[10px] text-muted-foreground">já na vitrine</span>}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
            <p className="text-[11px] text-muted-foreground">Vincular evita redigitar e mantém CPF e documentos no cadastro rural, já protegidos.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vf-nome">Nome *</Label>
            <Input id="vf-nome" value={f.nome} onChange={(e) => setF((s) => ({ ...s, nome: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Telefone</Label><Input inputMode="tel" value={f.telefone} onChange={(e) => setF((s) => ({ ...s, telefone: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>WhatsApp</Label><Input inputMode="tel" value={f.whatsapp} onChange={(e) => setF((s) => ({ ...s, whatsapp: e.target.value }))} placeholder="se diferente" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assentamento</Label>
              <Select value={f.settlement_id} onValueChange={(v) => setF((s) => ({ ...s, settlement_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {(settlements as any[]).map((st) => <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Comunidade / localidade</Label><Input value={f.localidade} onChange={(e) => setF((s) => ({ ...s, localidade: e.target.value }))} /></div>
          </div>

          <div className="space-y-1.5">
            <Label>Perfil informado</Label>
            <Chips options={PERFIS} value={f.perfis} onChange={(v) => setF((s) => ({ ...s, perfis: v }))} />
            <p className="text-[11px] text-muted-foreground">É o que o produtor declara; o enquadramento legal é comprovado pelos documentos.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Interesse em fornecer para</Label>
            <Chips options={PROGRAMAS} value={f.programas} onChange={(v) => setF((s) => ({ ...s, programas: v }))} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="vf-contato" className="cursor-pointer">Aceita ser contatado pela Administração</Label>
            <Switch id="vf-contato" checked={f.aceita_contato} onCheckedChange={(c) => setF((s) => ({ ...s, aceita_contato: c }))} />
          </div>

          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-medium">Mais informações (opcional)</summary>
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Nascimento</Label><Input type="date" value={f.data_nascimento} onChange={(e) => setF((s) => ({ ...s, data_nascimento: e.target.value }))} /></div>
                <div className="space-y-1.5">
                  <Label>Gênero</Label>
                  <Select value={f.genero} onValueChange={(v) => setF((s) => ({ ...s, genero: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {GENEROS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={f.email} onChange={(e) => setF((s) => ({ ...s, email: e.target.value }))} /></div>
              <div className="space-y-1.5">
                <Label>Localização no mapa</Label>
                <p className="text-[11px] text-muted-foreground">
                  {linked && linked.latitude != null
                    ? 'Vinculado ao cadastro rural: o mapa já usa a localização de lá. Preencha só se quiser outro ponto (ex.: local de coleta).'
                    : 'Sem vínculo com coordenadas: marque para o fornecedor aparecer no mapa.'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Input inputMode="decimal" placeholder="Latitude" value={f.latitude} onChange={(e) => setF((s) => ({ ...s, latitude: e.target.value }))} />
                  <Input inputMode="decimal" placeholder="Longitude" value={f.longitude} onChange={(e) => setF((s) => ({ ...s, longitude: e.target.value }))} />
                </div>
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={marcarLocalizacao} disabled={gpsLoading}>
                  {gpsLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Crosshair className="h-4 w-4 mr-2" />}
                  {gpsLoading ? 'Obtendo localização…' : 'Marcar localização atual'}
                </Button>
              </div>
            </div>
          </details>

          <div className="grid grid-cols-1 gap-3 rounded-lg border border-dashed p-3">
            <div className="space-y-1.5">
              <Label>Situação do cadastro (uso interno)</Label>
              <Select value={f.status} onValueChange={(v) => setF((s) => ({ ...s, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map((st) => <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Observação interna</Label>
              <Textarea rows={2} value={f.observacao_interna} onChange={(e) => setF((s) => ({ ...s, observacao_interna: e.target.value }))} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending || !f.nome.trim()}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {fornecedor ? 'Salvar' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
