import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/DataTable';
import { Plus, Pencil, Trash2, User } from 'lucide-react';
import { useCondutores, useSaveCondutor, useDeleteCondutor, type Condutor } from '@/hooks/useTransito';
import { useOperators } from '@/hooks/useOperatorData';
import { statusVencimento, vencClasses, vencLabel } from '@/lib/vencimento';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const NONE = '__none__';

export function CondutoresTab() {
  const { data: condutores = [], isLoading } = useCondutores();
  const { data: operators = [] } = useOperators();
  const save = useSaveCondutor();
  const del = useDeleteCondutor();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Condutor | null>(null);
  const [toDelete, setToDelete] = useState<Condutor | null>(null);

  const [f, setF] = useState({ name: '', cpf: '', matricula: '', cnh_numero: '', cnh_categoria: '', cnh_validade: '', telefone: '', operator_id: NONE });

  const openNew = () => { setEditing(null); setF({ name: '', cpf: '', matricula: '', cnh_numero: '', cnh_categoria: '', cnh_validade: '', telefone: '', operator_id: NONE }); setOpen(true); };
  const openEdit = (c: Condutor) => {
    setEditing(c);
    setF({ name: c.name || '', cpf: c.cpf || '', matricula: c.matricula || '', cnh_numero: c.cnh_numero || '', cnh_categoria: c.cnh_categoria || '', cnh_validade: (c.cnh_validade || '').slice(0, 10), telefone: c.telefone || '', operator_id: c.operator_id || NONE });
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate({
      id: editing?.id, name: f.name, cpf: f.cpf || null, matricula: f.matricula || null,
      cnh_numero: f.cnh_numero || null, cnh_categoria: f.cnh_categoria || null, cnh_validade: f.cnh_validade || null,
      telefone: f.telefone || null, operator_id: f.operator_id === NONE ? null : f.operator_id,
    }, { onSuccess: () => setOpen(false) });
  };

  const columns = [
    { key: 'name', header: 'Condutor', render: (c: Condutor) => (
      <span className="inline-flex items-center gap-2 font-medium"><User className="h-4 w-4 text-muted-foreground" />{c.name}</span>
    ) },
    { key: 'cpf', header: 'CPF', className: 'hidden sm:table-cell', render: (c: Condutor) => c.cpf || '—' },
    { key: 'matricula', header: 'Matrícula', className: 'hidden lg:table-cell', render: (c: Condutor) => c.matricula || '—' },
    { key: 'cnh', header: 'CNH', render: (c: Condutor) => {
      if (!c.cnh_validade) return <span className="text-sm text-muted-foreground">{c.cnh_categoria || '—'}</span>;
      const st = statusVencimento(c.cnh_validade);
      return <span className={cn('text-[11px] font-medium rounded-full px-2 py-0.5', vencClasses(st.status))}>
        {c.cnh_categoria ? `Cat. ${c.cnh_categoria} · ` : ''}{format(new Date(c.cnh_validade.slice(0,10)+'T12:00:00'),'dd/MM/yyyy',{locale:ptBR})} — {vencLabel(c.cnh_validade)}
      </span>;
    } },
    { key: 'active', header: 'Status', render: (c: Condutor) => <Badge variant="outline" className={c.is_active ? 'status-completed' : ''}>{c.is_active ? 'Ativo' : 'Inativo'}</Badge> },
    { key: 'actions', header: '', render: (c: Condutor) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setToDelete(c)}><Trash2 className="h-4 w-4" /></Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo condutor</Button>
      </div>
      <DataTable data={condutores} columns={columns} keyExtractor={(c) => c.id} isLoading={isLoading} emptyMessage="Nenhum condutor cadastrado" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar condutor' : 'Novo condutor'}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Vincular a um operador (opcional)</Label>
              <Select value={f.operator_id} onValueChange={(v) => {
                const opName = (operators as any[]).find((o) => o.id === v)?.name;
                setF((s) => ({ ...s, operator_id: v, name: v !== NONE && !s.name ? (opName || s.name) : s.name }));
              }}>
                <SelectTrigger><SelectValue placeholder="Nenhum (cadastro próprio)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum (cadastro próprio)</SelectItem>
                  {(operators as any[]).map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Nome *</Label>
              <Input id="c-name" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>CPF</Label><Input value={f.cpf} onChange={(e) => setF((s) => ({ ...s, cpf: e.target.value }))} inputMode="numeric" /></div>
              <div className="space-y-1.5"><Label>Matrícula</Label><Input value={f.matricula} onChange={(e) => setF((s) => ({ ...s, matricula: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5"><Label>CNH nº</Label><Input value={f.cnh_numero} onChange={(e) => setF((s) => ({ ...s, cnh_numero: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Cat.</Label><Input value={f.cnh_categoria} onChange={(e) => setF((s) => ({ ...s, cnh_categoria: e.target.value.toUpperCase() }))} /></div>
              <div className="space-y-1.5"><Label>Validade</Label><Input type="date" value={f.cnh_validade} onChange={(e) => setF((s) => ({ ...s, cnh_validade: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Telefone</Label><Input value={f.telefone} onChange={(e) => setF((s) => ({ ...s, telefone: e.target.value }))} inputMode="tel" /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={save.isPending}>{editing ? 'Salvar' : 'Cadastrar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}
        title="Excluir condutor" description={toDelete ? `Excluir "${toDelete.name}"? Multas/viagens ligadas a ele ficarão sem condutor.` : ''}
        onConfirm={() => { if (toDelete) del.mutate(toDelete.id); setToDelete(null); }} confirmLabel="Excluir" variant="destructive" />
    </div>
  );
}
