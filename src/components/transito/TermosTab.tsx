import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/DataTable';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, Trash2, Paperclip, Upload, Loader2, FileDown, FileSignature, ArrowRight } from 'lucide-react';
import { useTermos, useSaveTermo, useDeleteTermo, useCondutores, type Termo } from '@/hooks/useTransito';
import { useMachinery } from '@/hooks/useSupabaseData';
import { gerarTermoResponsabilidadePdf } from '@/lib/termoPdf';
import { CidadeUfInput, normalizeCidadeUf } from '@/components/transito/CidadeUfInput';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmt = (iso?: string | null) => (iso ? format(new Date(iso.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—');
const empty = { machinery_id: '', condutor_id: '', origem: 'Confresa/MT', destino: '', data_inicio: '', data_fim: '', finalidade: '', observacao: '' };

async function openFile(path: string) {
  const { data } = await supabase.storage.from('fleet-docs').createSignedUrl(path, 3600);
  if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

export function TermosTab() {
  const { data: termos = [], isLoading } = useTermos();
  const { data: machinery = [] } = useMachinery();
  const { data: condutores = [] } = useCondutores();
  const save = useSaveTermo();
  const del = useDeleteTermo();

  const veiculos = useMemo(() => (machinery as any[]).filter((m) => m.kind === 'veiculo'), [machinery]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Termo | null>(null);
  const [toDelete, setToDelete] = useState<Termo | null>(null);
  const [f, setF] = useState<typeof empty>(empty);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const openNew = () => { setEditing(null); setF(empty); setFile(null); if (fileRef.current) fileRef.current.value = ''; setOpen(true); };
  const openEdit = (t: Termo) => {
    setEditing(t);
    setF({ machinery_id: t.machinery_id, condutor_id: t.condutor_id, origem: t.origem || '', destino: t.destino || '', data_inicio: (t.data_inicio || '').slice(0, 10), data_fim: (t.data_fim || '').slice(0, 10), finalidade: '', observacao: t.observacao || '' });
    setFile(null); if (fileRef.current) fileRef.current.value = '';
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.machinery_id || !f.condutor_id || saving) return;
    setSaving(true);
    try {
      let file_path = editing?.file_path ?? null;
      if (file) {
        const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
        const path = `${f.machinery_id}/termos/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('fleet-docs').upload(path, file, { upsert: true });
        if (error) throw error;
        file_path = path;
      }
      await save.mutateAsync({
        id: editing?.id, machinery_id: f.machinery_id, condutor_id: f.condutor_id,
        origem: normalizeCidadeUf(f.origem), destino: normalizeCidadeUf(f.destino),
        data_inicio: f.data_inicio || null, data_fim: f.data_fim || null,
        observacao: f.observacao || null, file_path,
      });
      setOpen(false);
    } catch { /* erro exibido pelo hook/storage */ }
    finally { setSaving(false); }
  };

  const gerarPdf = () => {
    const v = veiculos.find((m) => m.id === f.machinery_id);
    const c = (condutores as any[]).find((x) => x.id === f.condutor_id);
    if (!v || !c) return;
    gerarTermoResponsabilidadePdf({
      veiculo: v.name, patrimonio: v.patrimony_number, placa: v.placa ?? null,
      condutor: c.name, cpf: c.cpf, matricula: c.matricula, cnh: c.cnh_numero, cnhCategoria: c.cnh_categoria,
      origem: normalizeCidadeUf(f.origem), destino: normalizeCidadeUf(f.destino),
      dataInicio: f.data_inicio || null, dataFim: f.data_fim || null,
      finalidade: f.finalidade || null, observacao: f.observacao || null,
    });
  };

  const columns = [
    { key: 'condutor', header: 'Condutor', render: (t: Termo) => (
      <span className="inline-flex items-center gap-2 font-medium"><FileSignature className="h-4 w-4 text-muted-foreground" />{t.condutores?.name || '—'}</span>
    ) },
    { key: 'veiculo', header: 'Veículo', render: (t: Termo) => t.machinery?.name || '—' },
    { key: 'trajeto', header: 'Trajeto', className: 'hidden sm:table-cell', render: (t: Termo) => (t.origem || t.destino) ? (
      <span className="inline-flex items-center gap-1.5 flex-wrap text-sm">{t.origem || '—'}<ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />{t.destino || '—'}</span>
    ) : '—' },
    { key: 'periodo', header: 'Período', className: 'hidden md:table-cell', render: (t: Termo) => `${fmt(t.data_inicio)} — ${fmt(t.data_fim)}` },
    { key: 'assinado', header: 'Assinado', render: (t: Termo) => t.file_path
      ? <button className="inline-flex items-center gap-1 text-blue-600 text-sm" onClick={() => openFile(t.file_path!)}><Paperclip className="h-3.5 w-3.5" />ver</button>
      : <span className="text-xs text-muted-foreground">pendente</span> },
    { key: 'actions', header: '', render: (t: Termo) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setToDelete(t)}><Trash2 className="h-4 w-4" /></Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo termo</Button>
      </div>
      <DataTable data={termos} columns={columns} keyExtractor={(t) => t.id} isLoading={isLoading} emptyMessage="Nenhum termo cadastrado" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar termo' : 'Novo termo de responsabilidade'}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Veículo *</Label>
                <Select value={f.machinery_id} onValueChange={(v) => setF((s) => ({ ...s, machinery_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{veiculos.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Condutor *</Label>
                <Select value={f.condutor_id} onValueChange={(v) => setF((s) => ({ ...s, condutor_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{(condutores as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Local de saída (Cidade/UF)</Label>
              <CidadeUfInput value={f.origem} onChange={(v) => setF((s) => ({ ...s, origem: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Destino (Cidade/UF)</Label>
              <CidadeUfInput value={f.destino} onChange={(v) => setF((s) => ({ ...s, destino: v }))} />
              {editing && <p className="text-[11px] text-muted-foreground">Alterações no termo são aplicadas às viagens vinculadas a ele.</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Início da cessão</Label><Input type="date" value={f.data_inicio} onChange={(e) => setF((s) => ({ ...s, data_inicio: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Fim da cessão</Label><Input type="date" value={f.data_fim} onChange={(e) => setF((s) => ({ ...s, data_fim: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Finalidade (para o PDF)</Label><Input value={f.finalidade || ''} onChange={(e) => setF((s) => ({ ...s, finalidade: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Observação</Label><Textarea value={f.observacao} onChange={(e) => setF((s) => ({ ...s, observacao: e.target.value }))} rows={2} /></div>

            <div className="rounded-lg border p-3 space-y-2">
              <Button type="button" variant="secondary" className="w-full" disabled={!f.machinery_id || !f.condutor_id} onClick={gerarPdf}>
                <FileDown className="h-4 w-4 mr-2" /> Gerar termo padronizado (PDF)
              </Button>
              <p className="text-[11px] text-muted-foreground">Baixe, colha as assinaturas e anexe o documento assinado abaixo.</p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" /> Anexar assinado</Button>
                <span className="text-xs text-muted-foreground truncate">{file ? file.name : (editing?.file_path ? 'arquivo anexado' : 'nenhum')}</span>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving || !f.machinery_id || !f.condutor_id}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editing ? 'Salvar' : 'Cadastrar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}
        title="Excluir termo" description={toDelete ? `Excluir o termo de "${toDelete.condutores?.name || 'condutor'}"?` : ''}
        onConfirm={() => { if (toDelete) del.mutate(toDelete.id); setToDelete(null); }} confirmLabel="Excluir" variant="destructive" />
    </div>
  );
}
