import { useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Trash2, Loader2, Plus, Paperclip, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useFleetDocuments, useCreateFleetDocument, useDeleteFleetDocument, type FleetDocument,
} from '@/hooks/useSupabaseData';
import { FLEET_DOC_TYPES, fleetDocLabel, statusVencimento, vencClasses, vencLabel } from '@/lib/vencimento';
import { cn } from '@/lib/utils';

interface FleetDocsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machineryId: string | null;
  machineryName?: string;
}

async function openFile(path: string) {
  const { data } = await supabase.storage.from('fleet-docs').createSignedUrl(path, 3600);
  if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

export function FleetDocsDialog({ open, onOpenChange, machineryId, machineryName }: FleetDocsDialogProps) {
  const { data: docs = [], isLoading } = useFleetDocuments(machineryId ?? undefined);
  const createDoc = useCreateFleetDocument();
  const deleteDoc = useDeleteFleetDocument();

  const [docType, setDocType] = useState('CRLV');
  const [description, setDescription] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [validade, setValidade] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<FleetDocument | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setDocType('CRLV'); setDescription(''); setResponsavel(''); setValidade(''); setFile(null); if (fileRef.current) fileRef.current.value = ''; };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineryId || saving) return;
    setSaving(true);
    try {
      let file_path: string | null = null;
      if (file) {
        const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
        const path = `${machineryId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('fleet-docs').upload(path, file, { upsert: true });
        if (error) throw error;
        file_path = path;
      }
      await createDoc.mutateAsync({
        machinery_id: machineryId, doc_type: docType,
        description: description.trim() || null, responsavel: responsavel.trim() || null,
        validade: validade || null, file_path,
      });
      reset();
    } catch { /* erro exibido pelo hook/storage */ }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Documentação — {machineryName}
          </DialogTitle>
          <DialogDescription>Registre documentos (opcional): tipo, validade, responsável e arquivo.</DialogDescription>
        </DialogHeader>

        {/* Novo documento */}
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo de documento</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FLEET_DOC_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fd-validade">Validade (opcional)</Label>
              <Input id="fd-validade" type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fd-resp">Responsável (opcional)</Label>
              <Input id="fd-resp" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Nome" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fd-desc">Descrição (opcional)</Label>
              <Input id="fd-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: apólice nº…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Arquivo (opcional — PDF ou imagem)</Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" /> Escolher arquivo
              </Button>
              <span className="text-xs text-muted-foreground truncate">{file ? file.name : 'nenhum arquivo'}</span>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Adicionar documento
            </Button>
          </div>
        </form>

        {/* Lista */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Documentos ({docs.length})</p>
          {isLoading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum documento cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {docs.map((d) => {
                const st = statusVencimento(d.validade);
                return (
                  <div key={d.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{fleetDocLabel(d.doc_type)}{d.description ? ` · ${d.description}` : ''}</p>
                      <div className="flex items-center flex-wrap gap-2 mt-0.5">
                        {d.validade && (
                          <span className={cn('text-[11px] font-medium rounded-full px-2 py-0.5', vencClasses(st.status))}>
                            {format(new Date(d.validade.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })} — {vencLabel(d.validade)}
                          </span>
                        )}
                        {d.responsavel && <span className="text-[11px] text-muted-foreground">Resp.: {d.responsavel}</span>}
                      </div>
                    </div>
                    {d.file_path && (
                      <Button type="button" variant="ghost" size="icon" className="shrink-0" title="Abrir arquivo" onClick={() => openFile(d.file_path!)}>
                        <Paperclip className="h-4 w-4 text-blue-500" />
                      </Button>
                    )}
                    <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive shrink-0" onClick={() => setToDelete(d)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => { if (!o) setToDelete(null); }}
        title="Remover documento"
        description={toDelete ? `Remover "${fleetDocLabel(toDelete.doc_type)}"? Esta ação não pode ser desfeita.` : ''}
        onConfirm={() => { if (toDelete) deleteDoc.mutate({ id: toDelete.id, machinery_id: toDelete.machinery_id }); setToDelete(null); }}
        confirmLabel="Remover"
        variant="destructive"
      />
    </Dialog>
  );
}
