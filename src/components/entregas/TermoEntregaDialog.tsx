// Termo / comprovante de entrega de UM produtor (uma entrega): anexar imagem
// ou PDF, abrir e remover. Aberto pelo botão no card da entrega.
import { useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FileText, Image as ImageIcon, Upload, Trash2, Loader2, Paperclip } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  useUploadTermosEntrega, useDeleteTermoEntrega, abrirTermoEntrega, LIMITE_COMPROVANTE_MB,
  type TermoEntrega,
} from '@/hooks/useSupabaseData';

const fmtTamanho = (b?: number | null) => (b == null ? '' : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryId: string | null;
  producerName?: string | null;
  demandName?: string | null;
  arquivos: TermoEntrega[];
}

export function TermoEntregaDialog({ open, onOpenChange, deliveryId, producerName, demandName, arquivos }: Props) {
  const { toast } = useToast();
  const { canDelete } = useAuth();
  const enviar = useUploadTermosEntrega();
  const remover = useDeleteTermoEntrega();
  const [aRemover, setARemover] = useState<TermoEntrega | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const aoEscolher = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const lista = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!lista.length || !deliveryId) return;
    try { await enviar.mutateAsync({ deliveryId, arquivos: lista }); } catch { /* aviso já exibido */ }
  };
  const abrir = async (t: TermoEntrega) => {
    try { await abrirTermoEntrega(t); } catch { toast({ title: 'Não foi possível abrir o arquivo', variant: 'destructive' }); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" /> Termo de entrega
            </DialogTitle>
            <DialogDescription>
              {[producerName, demandName].filter(Boolean).join(' — ')}
            </DialogDescription>
          </DialogHeader>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            className="hidden"
            onChange={aoEscolher}
          />

          {arquivos.length === 0 ? (
            <p className="rounded-md border border-dashed border-amber-400/60 bg-amber-500/5 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              Nenhum comprovante/termo anexado para esta entrega.
            </p>
          ) : (
            <ul className="space-y-1">
              {arquivos.map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-sm">
                  {t.mime_type === 'application/pdf'
                    ? <FileText className="h-4 w-4 text-red-600 shrink-0" />
                    : <ImageIcon className="h-4 w-4 text-blue-600 shrink-0" />}
                  <button type="button" onClick={() => abrir(t)} className="min-w-0 flex-1 truncate text-left text-primary hover:underline">
                    {t.file_name}
                  </button>
                  <span className="text-[11px] text-muted-foreground shrink-0">{fmtTamanho(t.size_bytes)}</span>
                  {canDelete && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0" title="Remover" onClick={() => setARemover(t)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-1">
            <Button className="w-full gap-2" onClick={() => inputRef.current?.click()} disabled={enviar.isPending || !deliveryId}>
              {enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {enviar.isPending ? 'Enviando…' : 'Anexar imagem ou PDF'}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">Até {LIMITE_COMPROVANTE_MB} MB por arquivo.</p>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!aRemover}
        onOpenChange={(o) => { if (!o) setARemover(null); }}
        title="Remover arquivo"
        description={aRemover ? `Remover "${aRemover.file_name}"? O arquivo será apagado.` : ''}
        onConfirm={() => { if (aRemover) remover.mutate(aRemover); setARemover(null); }}
        confirmLabel="Remover"
        variant="destructive"
      />
    </>
  );
}
