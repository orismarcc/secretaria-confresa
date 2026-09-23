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
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { useViagens, useSaveViagem, useDeleteViagem, useCondutores, VIAGEM_STATUS, viagemStatusLabel, type Viagem } from '@/hooks/useTransito';
import { useMachinery } from '@/hooks/useSupabaseData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const NONE = '__none__';
const fmt = (iso?: string | null) => (iso ? format(new Date(iso.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—');
const statusClass = (s: string) => ({
  programada: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  em_andamento: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  concluida: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelada: 'bg-muted text-muted-foreground',
}[s] || 'bg-muted text-muted-foreground');

const empty = { machinery_id: '', condutor_id: NONE, destino: '', nad: '', finalidade: '', data_saida: '', data_retorno: '', status: 'programada', observacao: '' };

export function ViagensTab() {
  const { data: viagens = [], isLoading } = useViagens();
  const { data: machinery = [] } = useMachinery();
  const { data: condutores = [] } = useCondutores();
  const save = useSaveViagem();
  const del = useDeleteViagem();

  const veiculos = useMemo(() => (machinery as any[]).filter((m) => m.kind === 'veiculo'), [machinery]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Viagem | null>(null);
  const [toDelete, setToDelete] = useState<Viagem | null>(null);
  const [f, setF] = useState<typeof empty>(empty);

  const openNew = () => { setEditing(null); setF(empty); setOpen(true); };
  const openEdit = (v: Viagem) => {
    setEditing(v);
    setF({ machinery_id: v.machinery_id, condutor_id: v.condutor_id || NONE, destino: v.destino || '', nad: v.nad || '', finalidade: v.finalidade || '', data_saida: (v.data_saida || '').slice(0, 10), data_retorno: (v.data_retorno || '').slice(0, 10), status: v.status, observacao: v.observacao || '' });
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.machinery_id) return;
    save.mutate({
      id: editing?.id, machinery_id: f.machinery_id, condutor_id: f.condutor_id === NONE ? null : f.condutor_id,
      destino: f.destino || null, nad: f.nad || null, finalidade: f.finalidade || null,
      data_saida: f.data_saida || null, data_retorno: f.data_retorno || null, status: f.status, observacao: f.observacao || null,
    }, { onSuccess: () => setOpen(false) });
  };

  const columns = [
    { key: 'destino', header: 'Destino', render: (v: Viagem) => (
      <div className="min-w-0">
        <p className="font-medium inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{v.destino || '—'}</p>
        {v.nad && <p className="text-[11px] text-muted-foreground">NAD {v.nad}</p>}
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Veículo *</Label>
                <Select value={f.machinery_id} onValueChange={(v) => setF((s) => ({ ...s, machinery_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {veiculos.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Condutor</Label>
                <Select value={f.condutor_id} onValueChange={(v) => setF((s) => ({ ...s, condutor_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Não definido</SelectItem>
                    {(condutores as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Destino</Label><Input value={f.destino} onChange={(e) => setF((s) => ({ ...s, destino: e.target.value }))} placeholder="Cidade / local" /></div>
              <div className="space-y-1.5"><Label>NAD</Label><Input value={f.nad} onChange={(e) => setF((s) => ({ ...s, nad: e.target.value }))} placeholder="Nº da autorização" /></div>
            </div>
            <div className="space-y-1.5"><Label>Finalidade</Label><Input value={f.finalidade} onChange={(e) => setF((s) => ({ ...s, finalidade: e.target.value }))} /></div>
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
        title="Excluir viagem" description={toDelete ? `Excluir a viagem para "${toDelete.destino || 'destino não informado'}"?` : ''}
        onConfirm={() => { if (toDelete) del.mutate(toDelete.id); setToDelete(null); }} confirmLabel="Excluir" variant="destructive" />
    </div>
  );
}
