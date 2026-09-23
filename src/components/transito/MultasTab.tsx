import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/DataTable';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, Trash2, Paperclip, Upload, Loader2, AlertTriangle } from 'lucide-react';
import { useMultas, useSaveMulta, useDeleteMulta, useCondutores, useViagens, useTermos, MULTA_STATUS, multaStatusLabel, termoLabel, type Multa } from '@/hooks/useTransito';
import { useMachinery } from '@/hooks/useSupabaseData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const NONE = '__none__';
const fmt = (iso?: string | null) => (iso ? format(new Date(iso.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—');
const brl = (v?: number | null) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const statusClass = (s: string) => ({
  pendente: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  condutor_identificado: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  em_recurso: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  vencida: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  paga: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelada: 'bg-muted text-muted-foreground',
}[s] || 'bg-muted text-muted-foreground');

const empty = {
  machinery_id: '', condutor_id: NONE, viagem_id: NONE, termo_id: NONE,
  data: '', horario: '', local: '', placa: '', auto_infracao: '', orgao_autuador: '', infracao: '',
  valor: '', pontos: '', condutor_identificado: false, data_limite_recurso: '', status: 'pendente', observacao: '',
};

async function openFile(path: string) {
  const { data } = await supabase.storage.from('fleet-docs').createSignedUrl(path, 3600);
  if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

export function MultasTab() {
  const { data: multas = [], isLoading } = useMultas();
  const { data: machinery = [] } = useMachinery();
  const { data: condutores = [] } = useCondutores();
  const { data: viagens = [] } = useViagens();
  const { data: termos = [] } = useTermos();
  const save = useSaveMulta();
  const del = useDeleteMulta();

  const veiculos = useMemo(() => (machinery as any[]).filter((m) => m.kind === 'veiculo'), [machinery]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Multa | null>(null);
  const [toDelete, setToDelete] = useState<Multa | null>(null);
  const [f, setF] = useState<typeof empty>(empty);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Viagens/termos filtrados pelo veículo selecionado (vínculo coerente)
  const viagensDoVeiculo = useMemo(() => viagens.filter((v) => !f.machinery_id || v.machinery_id === f.machinery_id), [viagens, f.machinery_id]);
  const termosDoVeiculo = useMemo(() => termos.filter((t) => !f.machinery_id || t.machinery_id === f.machinery_id), [termos, f.machinery_id]);

  // Viagem escolhida → traz termo e condutor dela (encadeamento multa → viagem → termo → condutor).
  const escolherViagem = (id: string) => {
    const v = id !== NONE ? viagens.find((x) => x.id === id) : undefined;
    setF((s) => ({
      ...s, viagem_id: id,
      termo_id: v?.termo_id || s.termo_id,
      condutor_id: v?.condutor_id || s.condutor_id,
      condutor_identificado: v?.condutor_id ? true : s.condutor_identificado,
    }));
  };
  // Termo escolhido → traz o condutor responsável.
  const escolherTermo = (id: string) => {
    const t = id !== NONE ? termos.find((x) => x.id === id) : undefined;
    setF((s) => ({
      ...s, termo_id: id,
      condutor_id: t?.condutor_id || s.condutor_id,
      condutor_identificado: t?.condutor_id ? true : s.condutor_identificado,
    }));
  };

  const openNew = () => { setEditing(null); setF(empty); setFile(null); if (fileRef.current) fileRef.current.value = ''; setOpen(true); };
  const openEdit = (m: Multa) => {
    setEditing(m);
    setF({
      machinery_id: m.machinery_id, condutor_id: m.condutor_id || NONE, viagem_id: m.viagem_id || NONE, termo_id: m.termo_id || NONE,
      data: (m.data || '').slice(0, 10), horario: m.horario || '', local: m.local || '', placa: m.placa || '',
      auto_infracao: m.auto_infracao || '', orgao_autuador: m.orgao_autuador || '', infracao: m.infracao || '',
      valor: m.valor == null ? '' : String(m.valor), pontos: m.pontos == null ? '' : String(m.pontos),
      condutor_identificado: m.condutor_identificado, data_limite_recurso: (m.data_limite_recurso || '').slice(0, 10),
      status: m.status, observacao: m.observacao || '',
    });
    setFile(null); if (fileRef.current) fileRef.current.value = '';
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.machinery_id || saving) return;
    setSaving(true);
    try {
      let file_path = editing?.file_path ?? null;
      if (file) {
        const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
        const path = `${f.machinery_id}/multas/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('fleet-docs').upload(path, file, { upsert: true });
        if (error) throw error;
        file_path = path;
      }
      await save.mutateAsync({
        id: editing?.id, machinery_id: f.machinery_id,
        condutor_id: f.condutor_id === NONE ? null : f.condutor_id,
        viagem_id: f.viagem_id === NONE ? null : f.viagem_id,
        termo_id: f.termo_id === NONE ? null : f.termo_id,
        data: f.data || null, horario: f.horario || null, local: f.local || null, placa: f.placa || null,
        auto_infracao: f.auto_infracao || null, orgao_autuador: f.orgao_autuador || null, infracao: f.infracao || null,
        valor: f.valor === '' ? null : Number(f.valor), pontos: f.pontos === '' ? null : Number(f.pontos),
        condutor_identificado: f.condutor_identificado, data_limite_recurso: f.data_limite_recurso || null,
        status: f.status, observacao: f.observacao || null, file_path,
      });
      setOpen(false);
    } catch { /* erro exibido pelo hook/storage */ }
    finally { setSaving(false); }
  };

  const columns = [
    { key: 'infracao', header: 'Infração', render: (m: Multa) => (
      <div className="min-w-0">
        <p className="font-medium truncate max-w-[220px]">{m.infracao || m.auto_infracao || '—'}</p>
        <p className="text-[11px] text-muted-foreground">{fmt(m.data)}{m.horario ? ` · ${m.horario}` : ''}{m.local ? ` · ${m.local}` : ''}</p>
      </div>
    ) },
    { key: 'veiculo', header: 'Veículo', className: 'hidden sm:table-cell', render: (m: Multa) => (
      <div><p>{m.machinery?.name || '—'}</p>{m.placa && <p className="text-[11px] text-muted-foreground">{m.placa}</p>}</div>
    ) },
    { key: 'condutor', header: 'Condutor', className: 'hidden md:table-cell', render: (m: Multa) => m.condutores?.name || (m.condutor_identificado ? '—' : <span className="inline-flex items-center gap-1 text-amber-600 text-xs"><AlertTriangle className="h-3 w-3" />não id.</span>) },
    { key: 'valor', header: 'Valor', className: 'hidden lg:table-cell', render: (m: Multa) => brl(m.valor) },
    { key: 'status', header: 'Status', render: (m: Multa) => <Badge variant="outline" className={statusClass(m.status)}>{multaStatusLabel(m.status)}</Badge> },
    { key: 'actions', header: '', render: (m: Multa) => (
      <div className="flex gap-1">
        {m.file_path && <Button variant="ghost" size="icon" title="Auto de infração" onClick={() => openFile(m.file_path!)}><Paperclip className="h-4 w-4 text-blue-500" /></Button>}
        <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setToDelete(m)}><Trash2 className="h-4 w-4" /></Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Nova multa</Button>
      </div>
      <DataTable data={multas} columns={columns} keyExtractor={(m) => m.id} isLoading={isLoading} emptyMessage="Nenhuma multa registrada" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar multa' : 'Nova multa'}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            {/* Vínculos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border p-3">
              <div className="space-y-1.5">
                <Label>Veículo *</Label>
                <Select value={f.machinery_id} onValueChange={(v) => setF((s) => ({ ...s, machinery_id: v, viagem_id: NONE, termo_id: NONE }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{veiculos.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Condutor</Label>
                <Select value={f.condutor_id} onValueChange={(v) => setF((s) => ({ ...s, condutor_id: v, condutor_identificado: v !== NONE ? true : s.condutor_identificado }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Não definido</SelectItem>
                    {(condutores as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Viagem vinculada</Label>
                <Select value={f.viagem_id} onValueChange={escolherViagem}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nenhuma</SelectItem>
                    {viagensDoVeiculo.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.origem || '?'} → {v.destino || '?'}{v.data_saida ? ` · ${fmt(v.data_saida)}` : ''}{v.nad ? ` — NAD ${v.nad}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Termo de responsabilidade</Label>
                <Select value={f.termo_id} onValueChange={escolherTermo}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nenhum</SelectItem>
                    {termosDoVeiculo.map((t) => <SelectItem key={t.id} value={t.id}>{termoLabel(t)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dados da infração */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={f.data} onChange={(e) => setF((s) => ({ ...s, data: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Horário</Label><Input type="time" value={f.horario} onChange={(e) => setF((s) => ({ ...s, horario: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Placa</Label><Input value={f.placa} onChange={(e) => setF((s) => ({ ...s, placa: e.target.value.toUpperCase() }))} /></div>
              <div className="space-y-1.5"><Label>Auto de infração</Label><Input value={f.auto_infracao} onChange={(e) => setF((s) => ({ ...s, auto_infracao: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Local</Label><Input value={f.local} onChange={(e) => setF((s) => ({ ...s, local: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Infração</Label><Input value={f.infracao} onChange={(e) => setF((s) => ({ ...s, infracao: e.target.value }))} placeholder="Descrição da infração" /></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5"><Label>Órgão autuador</Label><Input value={f.orgao_autuador} onChange={(e) => setF((s) => ({ ...s, orgao_autuador: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Valor (R$)</Label><Input type="number" step="0.01" inputMode="decimal" value={f.valor} onChange={(e) => setF((s) => ({ ...s, valor: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Pontos</Label><Input type="number" inputMode="numeric" value={f.pontos} onChange={(e) => setF((s) => ({ ...s, pontos: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Limite p/ recurso</Label><Input type="date" value={f.data_limite_recurso} onChange={(e) => setF((s) => ({ ...s, data_limite_recurso: e.target.value }))} /></div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border p-3">
              <Checkbox id="m-cond-id" checked={f.condutor_identificado} onCheckedChange={(c) => setF((s) => ({ ...s, condutor_identificado: !!c }))} />
              <Label htmlFor="m-cond-id" className="cursor-pointer">Condutor identificado?</Label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={f.status} onValueChange={(v) => setF((s) => ({ ...s, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MULTA_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Auto de infração (arquivo)</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" /> Anexar</Button>
                  <span className="text-xs text-muted-foreground truncate">{file ? file.name : (editing?.file_path ? 'arquivo anexado' : 'nenhum')}</span>
                  <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
                </div>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Observação</Label><Textarea value={f.observacao} onChange={(e) => setF((s) => ({ ...s, observacao: e.target.value }))} rows={2} /></div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving || !f.machinery_id}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editing ? 'Salvar' : 'Cadastrar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}
        title="Excluir multa" description={toDelete ? `Excluir a multa "${toDelete.infracao || toDelete.auto_infracao || 'sem descrição'}"?` : ''}
        onConfirm={() => { if (toDelete) del.mutate(toDelete.id); setToDelete(null); }} confirmLabel="Excluir" variant="destructive" />
    </div>
  );
}
