import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/DataTable';
import { Plus, Pencil, Trash2, ArrowRight, FileSignature, Link2 } from 'lucide-react';
import { useViagens, useSaveViagem, useDeleteViagem, useCondutores, useTermos, VIAGEM_STATUS, viagemStatusLabel, termoLabel, type Viagem } from '@/hooks/useTransito';
import { useMachinery } from '@/hooks/useSupabaseData';
import { CidadeUfInput, normalizeCidadeUf } from '@/components/transito/CidadeUfInput';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const NONE = '__none__';
const ORIGEM_PADRAO = 'Confresa/MT';
const fmt = (iso?: string | null) => (iso ? format(new Date(iso.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—');
const statusClass = (s: string) => ({
  programada: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  em_andamento: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  concluida: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelada: 'bg-muted text-muted-foreground',
}[s] || 'bg-muted text-muted-foreground');

const empty = { termo_id: NONE, machinery_id: '', condutor_id: NONE, origem: ORIGEM_PADRAO, destino: '', nad: '', finalidade: '', data_saida: '', data_retorno: '', status: 'programada', observacao: '' };

export function ViagensTab() {
  const { data: viagens = [], isLoading } = useViagens();
  const { data: machinery = [] } = useMachinery();
  const { data: condutores = [] } = useCondutores();
  const { data: termos = [] } = useTermos();
  const save = useSaveViagem();
  const del = useDeleteViagem();

  const veiculos = useMemo(() => (machinery as any[]).filter((m) => m.kind === 'veiculo'), [machinery]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Viagem | null>(null);
  const [toDelete, setToDelete] = useState<Viagem | null>(null);
  const [f, setF] = useState<typeof empty>(empty);

  // Termo escolhido: veículo e condutor vêm dele; origem/destino também, quando o termo os define.
  const termo = f.termo_id !== NONE ? termos.find((t) => t.id === f.termo_id) : undefined;
  const lockOrigem = !!termo?.origem;
  const lockDestino = !!termo?.destino;

  const aplicarTermo = (id: string) => {
    if (id === NONE) { setF((s) => ({ ...s, termo_id: NONE })); return; }
    const t = termos.find((x) => x.id === id);
    if (!t) return;
    setF((s) => ({
      ...s, termo_id: id, machinery_id: t.machinery_id, condutor_id: t.condutor_id,
      origem: t.origem || s.origem, destino: t.destino || s.destino,
    }));
  };

  const openNew = () => { setEditing(null); setF(empty); setOpen(true); };
  const openEdit = (v: Viagem) => {
    setEditing(v);
    setF({
      termo_id: v.termo_id || NONE, machinery_id: v.machinery_id, condutor_id: v.condutor_id || NONE,
      origem: v.origem || '', destino: v.destino || '', nad: v.nad || '', finalidade: v.finalidade || '',
      data_saida: (v.data_saida || '').slice(0, 10), data_retorno: (v.data_retorno || '').slice(0, 10),
      status: v.status, observacao: v.observacao || '',
    });
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.machinery_id) return;
    // O banco reaplica os dados do termo (trigger), então aqui só enviamos o formulário.
    save.mutate({
      id: editing?.id, termo_id: f.termo_id === NONE ? null : f.termo_id,
      machinery_id: f.machinery_id, condutor_id: f.condutor_id === NONE ? null : f.condutor_id,
      origem: normalizeCidadeUf(f.origem), destino: normalizeCidadeUf(f.destino),
      nad: f.nad.trim() || null, finalidade: f.finalidade.trim() || null,
      data_saida: f.data_saida || null, data_retorno: f.data_retorno || null, status: f.status, observacao: f.observacao.trim() || null,
    }, { onSuccess: () => setOpen(false) });
  };

  const columns = [
    { key: 'trajeto', header: 'Trajeto', render: (v: Viagem) => (
      <div className="min-w-0">
        <p className="font-medium inline-flex items-center gap-1.5 flex-wrap">
          <span>{v.origem || '—'}</span><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /><span>{v.destino || '—'}</span>
        </p>
        <p className="text-[11px] text-muted-foreground inline-flex items-center gap-2">
          {v.nad && <span>NAD {v.nad}</span>}
          {v.termo_id && <span className="inline-flex items-center gap-1"><FileSignature className="h-3 w-3" />sob termo</span>}
        </p>
      </div>
    ) },
    { key: 'veiculo', header: 'Veículo', render: (v: Viagem) => v.machinery?.name || '—' },
    { key: 'condutor', header: 'Condutor', className: 'hidden sm:table-cell', render: (v: Viagem) => v.condutores?.name || '—' },
    { key: 'saida', header: 'Saída', className: 'hidden md:table-cell', render: (v: Viagem) => fmt(v.data_saida) },
    { key: 'status', header: 'Status', render: (v: Viagem) => <Badge variant="outline" className={statusClass(v.status)}>{viagemStatusLabel(v.status)}</Badge> },
    { key: 'actions', header: '', render: (v: Viagem) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setToDelete(v)}><Trash2 className="h-4 w-4" /></Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Nova viagem</Button>
      </div>
      <DataTable data={viagens} columns={columns} keyExtractor={(v) => v.id} isLoading={isLoading} emptyMessage="Nenhuma viagem programada" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar viagem' : 'Nova viagem'}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5 rounded-lg border p-3">
              <Label className="inline-flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Termo de responsabilidade</Label>
              <Select value={f.termo_id} onValueChange={aplicarTermo}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem termo</SelectItem>
                  {termos.map((t) => <SelectItem key={t.id} value={t.id}>{termoLabel(t)}</SelectItem>)}
                </SelectContent>
              </Select>
              {termo && <p className="text-[11px] text-muted-foreground">Veículo, condutor e trajeto definidos no termo ficam amarrados a ele.</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Veículo *</Label>
                <Select value={f.machinery_id} disabled={!!termo} onValueChange={(v) => setF((s) => ({ ...s, machinery_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {veiculos.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Condutor</Label>
                <Select value={f.condutor_id} disabled={!!termo} onValueChange={(v) => setF((s) => ({ ...s, condutor_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Não definido</SelectItem>
                    {condutores.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Local de saída (Cidade/UF)</Label>
              <CidadeUfInput value={f.origem} disabled={lockOrigem} onChange={(v) => setF((s) => ({ ...s, origem: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Destino (Cidade/UF)</Label>
              <CidadeUfInput value={f.destino} disabled={lockDestino} onChange={(v) => setF((s) => ({ ...s, destino: v }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>NAD</Label><Input value={f.nad} onChange={(e) => setF((s) => ({ ...s, nad: e.target.value }))} placeholder="Nº da autorização" /></div>
              <div className="space-y-1.5"><Label>Finalidade</Label><Input value={f.finalidade} onChange={(e) => setF((s) => ({ ...s, finalidade: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Saída</Label><Input type="date" value={f.data_saida} onChange={(e) => setF((s) => ({ ...s, data_saida: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Retorno</Label><Input type="date" value={f.data_retorno} onChange={(e) => setF((s) => ({ ...s, data_retorno: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => setF((s) => ({ ...s, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VIAGEM_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Observação</Label><Textarea value={f.observacao} onChange={(e) => setF((s) => ({ ...s, observacao: e.target.value }))} rows={2} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={save.isPending || !f.machinery_id}>{editing ? 'Salvar' : 'Cadastrar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}
        title="Excluir viagem" description={toDelete ? `Excluir a viagem ${toDelete.origem || '?'} → ${toDelete.destino || '?'}?` : ''}
        onConfirm={() => { if (toDelete) del.mutate(toDelete.id); setToDelete(null); }} confirmLabel="Excluir" variant="destructive" />
    </div>
  );
}
