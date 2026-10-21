// Fotos das propriedades do produtor (ficha do produtor). Várias fotos por
// propriedade; property_id nulo = propriedade PRINCIPAL. Só equipe interna.
import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { friendlyDbError } from '@/lib/dbErrors';
import { problemaFoto } from '@/lib/fotosAtendimento';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Camera, ImagePlus, Loader2, Trash2 } from 'lucide-react';

const BUCKET = 'property-photos';

interface FotoPropriedade {
  id: string; producer_id: string; property_id: string | null;
  file_path: string; file_name: string; created_at: string; url?: string;
}

/** Todas as fotos das propriedades de um produtor (com link temporário). */
export function useFotosPropriedades(producerId: string | null) {
  return useQuery({
    queryKey: ['producer_property_photos', producerId],
    enabled: !!producerId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('producer_property_photos')
        .select('id, producer_id, property_id, file_path, file_name, created_at')
        .eq('producer_id', producerId).order('created_at', { ascending: true });
      if (error) throw error;
      return Promise.all(((data ?? []) as FotoPropriedade[]).map(async (f) => {
        try {
          const { data: s } = await supabase.storage.from(BUCKET).createSignedUrl(f.file_path, 3600);
          return { ...f, url: s?.signedUrl };
        } catch { return f; }
      }));
    },
  });
}

/** Botão com a quantidade de fotos; abre a galeria daquela propriedade. */
export function BotaoFotosPropriedade({ producerId, propertyId, titulo }: {
  producerId: string; propertyId: string | null; titulo: string;
}) {
  const [aberto, setAberto] = useState(false);
  const { data: todas = [] } = useFotosPropriedades(producerId);
  const n = todas.filter((f) => (f.property_id ?? null) === propertyId).length;
  return (
    <>
      <Button variant="ghost" size="sm" className="h-8 shrink-0 gap-1 px-2" title="Fotos da propriedade" onClick={() => setAberto(true)}>
        <Camera className="h-4 w-4 text-primary" />
        {n > 0 && <span className="text-xs font-semibold">{n}</span>}
      </Button>
      {aberto && <FotosPropriedadeDialog producerId={producerId} propertyId={propertyId} titulo={titulo} onClose={() => setAberto(false)} />}
    </>
  );
}

function FotosPropriedadeDialog({ producerId, propertyId, titulo, onClose }: {
  producerId: string; propertyId: string | null; titulo: string; onClose: () => void;
}) {
  const { toast } = useToast();
  const { canDelete } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [aRemover, setARemover] = useState<FotoPropriedade | null>(null);
  const { data: todas = [], isLoading } = useFotosPropriedades(producerId);
  const fotos = useMemo(() => todas.filter((f) => (f.property_id ?? null) === propertyId), [todas, propertyId]);
  const atualizar = () => queryClient.invalidateQueries({ queryKey: ['producer_property_photos', producerId] });

  const enviar = useMutation({
    mutationFn: async (arquivos: File[]) => {
      let n = 0;
      for (const f of arquivos) {
        const erro = problemaFoto(f);
        if (erro) throw new Error(erro);
        const ext = f.type === 'image/png' ? 'png' : f.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${producerId}/${propertyId ?? 'principal'}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type, upsert: false });
        if (upErr) throw upErr;
        const { error } = await (supabase as any).from('producer_property_photos').insert({
          producer_id: producerId, property_id: propertyId, file_path: path, file_name: f.name.slice(0, 200),
          mime_type: f.type, size_bytes: f.size,
        });
        if (error) { await supabase.storage.from(BUCKET).remove([path]); throw error; }
        n++;
      }
      return n;
    },
    onSuccess: (n) => { atualizar(); toast({ title: `${n} foto(s) adicionada(s)` }); },
    onError: (e: Error) => { atualizar(); toast({ title: 'Erro ao adicionar foto', description: friendlyDbError(e), variant: 'destructive' }); },
  });

  const remover = useMutation({
    mutationFn: async (f: FotoPropriedade) => {
      const { error } = await (supabase as any).from('producer_property_photos').delete().eq('id', f.id);
      if (error) throw error;
      await supabase.storage.from(BUCKET).remove([f.file_path]);
    },
    onSuccess: () => { atualizar(); toast({ title: 'Foto removida' }); },
    onError: (e: Error) => toast({ title: 'Erro ao remover foto', description: friendlyDbError(e), variant: 'destructive' }),
  });

  return (
    <>
      <Dialog open onOpenChange={(o) => { if (!o && !enviar.isPending) onClose(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Camera className="h-4 w-4 text-primary" /> Fotos da propriedade</DialogTitle>
            <DialogDescription>{titulo}</DialogDescription>
          </DialogHeader>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
            onChange={(e) => { const a = Array.from(e.target.files ?? []); e.target.value = ''; if (a.length) enviar.mutate(a); }} />
          {isLoading ? <Skeleton className="h-32 w-full" /> : fotos.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Nenhuma foto desta propriedade ainda.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {fotos.map((f) => (
                <div key={f.id} className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                  <button type="button" className="h-full w-full" onClick={() => f.url && window.open(f.url, '_blank')} title="Abrir foto">
                    {f.url && <img src={f.url} alt={f.file_name} className="h-full w-full object-cover" />}
                  </button>
                  {canDelete && (
                    <button type="button" onClick={() => setARemover(f)} title="Remover foto"
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <Button className="w-full gap-2" onClick={() => inputRef.current?.click()} disabled={enviar.isPending}>
            {enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {enviar.isPending ? 'Enviando…' : 'Adicionar fotos (câmera ou galeria)'}
          </Button>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!aRemover}
        onOpenChange={(o) => { if (!o) setARemover(null); }}
        title="Remover foto"
        description="A foto será apagada desta propriedade."
        onConfirm={() => { if (aRemover) remover.mutate(aRemover); setARemover(null); }}
        confirmLabel="Remover"
        variant="destructive"
      />
    </>
  );
}
