// Edição das fotos de um atendimento FINALIZADO — só administradores plenos
// (Secretário/Diretor/Supervisor). Trocar, remover e adicionar por etapa.
//
// Cuidados para não atrapalhar nada:
//   * trocar mantém o registro (horário e GPS) — só muda a imagem;
//   * remover uma foto que tem GPS tira só a imagem e preserva a localização
//     (usada no mapa, na rota da logística e no cadastro da propriedade);
//   * o arquivo antigo NÃO é apagado do armazenamento, e a troca/remoção fica
//     na auditoria (quem, quando, foto antiga) — dá para recuperar;
//   * as telas que mostram as fotos são só atualizadas (mesmas consultas).
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useServicePhotos } from '@/hooks/useServicePhotos';
import { useToast } from '@/hooks/use-toast';
import { friendlyDbError } from '@/lib/dbErrors';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ImagePlus, RefreshCw, Trash2, Loader2, Pencil } from 'lucide-react';

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp'];
const LIMITE_MB = 10;

type Etapa = 'start' | 'loading' | 'delivery' | 'finish';

interface FotoRow {
  id: string;
  storage_path: string;
  event_type?: string | null;
  latitude?: number | null;
  captured_at?: string | null;
  url?: string;
}

function etapas(isLogistics: boolean): { tipo: Etapa; rotulo: string }[] {
  return isLogistics
    ? [
        { tipo: 'start', rotulo: 'Início (odômetro)' },
        { tipo: 'loading', rotulo: 'Carregamento' },
        { tipo: 'delivery', rotulo: 'Entrega na propriedade' },
        { tipo: 'finish', rotulo: 'Finalização' },
      ]
    : [
        { tipo: 'start', rotulo: 'Início do serviço' },
        { tipo: 'finish', rotulo: 'Término do serviço' },
      ];
}

async function enviarArquivo(serviceId: string, file: File): Promise<string> {
  if (!TIPOS_ACEITOS.includes(file.type)) throw new Error('Envie uma imagem JPG, PNG ou WEBP.');
  if (file.size > LIMITE_MB * 1024 * 1024) throw new Error(`A imagem tem mais de ${LIMITE_MB} MB.`);
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${serviceId}/admin-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('service-photos')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export function EditarFotosAtendimento({ serviceId, isLogistics }: { serviceId: string; isLogistics: boolean }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAberto(true)}>
        <Pencil className="h-3.5 w-3.5" /> Editar fotos
      </Button>
      {aberto && (
        <EditarFotosDialog serviceId={serviceId} isLogistics={isLogistics} onClose={() => setAberto(false)} />
      )}
    </>
  );
}

function EditarFotosDialog({ serviceId, isLogistics, onClose }: { serviceId: string; isLogistics: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: fotos = [], isLoading } = useServicePhotos(serviceId);
  const inputRef = useRef<HTMLInputElement>(null);
  const acao = useRef<{ tipo: 'trocar'; foto: FotoRow } | { tipo: 'adicionar'; etapa: Etapa } | null>(null);
  const [aRemover, setARemover] = useState<FotoRow | null>(null);

  const atualizar = () => {
    queryClient.invalidateQueries({ queryKey: ['service_photos', serviceId] });
    queryClient.invalidateQueries({ queryKey: ['service_events', serviceId] });
  };
  const erro = (titulo: string) => (e: Error) => toast({ title: titulo, description: friendlyDbError(e), variant: 'destructive' });

  const trocar = useMutation({
    mutationFn: async ({ foto, file }: { foto: FotoRow; file: File }) => {
      const path = await enviarArquivo(serviceId, file);
      const { error } = await supabase.from('service_photos').update({ storage_path: path }).eq('id', foto.id);
      if (error) { await supabase.storage.from('service-photos').remove([path]); throw error; }
    },
    onSuccess: () => { atualizar(); toast({ title: 'Foto trocada' }); },
    onError: erro('Erro ao trocar a foto'),
  });

  const adicionar = useMutation({
    mutationFn: async ({ etapa, file }: { etapa: Etapa; file: File }) => {
      const path = await enviarArquivo(serviceId, file);
      const { error } = await supabase.from('service_photos').insert({
        service_id: serviceId, storage_path: path, event_type: etapa, captured_at: new Date().toISOString(),
      } as any);
      if (error) { await supabase.storage.from('service-photos').remove([path]); throw error; }
    },
    onSuccess: () => { atualizar(); toast({ title: 'Foto adicionada' }); },
    onError: erro('Erro ao adicionar a foto'),
  });

  const remover = useMutation({
    mutationFn: async (foto: FotoRow) => {
      // Com GPS: mantém o registro (localização) e tira só a imagem.
      const { error } = foto.latitude != null
        ? await supabase.from('service_photos').update({ storage_path: null } as any).eq('id', foto.id)
        : await supabase.from('service_photos').delete().eq('id', foto.id);
      if (error) throw error;
    },
    onSuccess: () => { atualizar(); toast({ title: 'Foto removida' }); },
    onError: erro('Erro ao remover a foto'),
  });

  const ocupado = trocar.isPending || adicionar.isPending || remover.isPending;

  const escolher = (a: NonNullable<typeof acao.current>) => { acao.current = a; inputRef.current?.click(); };
  const aoEscolher = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const a = acao.current;
    acao.current = null;
    if (!file || !a) return;
    if (a.tipo === 'trocar') trocar.mutate({ foto: a.foto, file });
    else adicionar.mutate({ etapa: a.etapa, file });
  };

  const lista = etapas(isLogistics);
  const conhecidas = new Set(lista.map((x) => x.tipo as string));
  const outras = (fotos as FotoRow[]).filter((f) => !conhecidas.has(f.event_type || ''));

  const cartao = (f: FotoRow) => (
    <div key={f.id} className="w-24 space-y-1">
      <button type="button" onClick={() => f.url && window.open(f.url, '_blank')}
        className="block aspect-[9/16] w-24 overflow-hidden rounded-md border bg-muted" title="Abrir foto">
        {f.url && <img src={f.url} alt="Foto do atendimento" className="h-full w-full object-cover" />}
      </button>
      <div className="flex gap-1">
        <Button type="button" variant="outline" size="icon" className="h-7 flex-1" title="Trocar foto"
          disabled={ocupado} onClick={() => escolher({ tipo: 'trocar', foto: f })}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="outline" size="icon" className="h-7 flex-1 text-destructive hover:text-destructive" title="Remover foto"
          disabled={ocupado} onClick={() => setARemover(f)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open onOpenChange={(o) => { if (!o && !ocupado) onClose(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar fotos do atendimento</DialogTitle>
            <DialogDescription>
              Trocar mantém o horário e a localização do registro. As fotos substituídas ou removidas ficam guardadas na auditoria.
            </DialogDescription>
          </DialogHeader>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={aoEscolher} />

          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <div className="space-y-4">
              {lista.map(({ tipo, rotulo }) => {
                const doTipo = (fotos as FotoRow[]).filter((f) => f.event_type === tipo);
                return (
                  <div key={tipo} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{rotulo}</p>
                      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" disabled={ocupado}
                        onClick={() => escolher({ tipo: 'adicionar', etapa: tipo })}>
                        <ImagePlus className="h-3.5 w-3.5" /> Adicionar
                      </Button>
                    </div>
                    {doTipo.length === 0
                      ? <p className="text-xs text-muted-foreground">Sem foto.</p>
                      : <div className="flex flex-wrap gap-2">{doTipo.map(cartao)}</div>}
                  </div>
                );
              })}
              {outras.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Outras fotos</p>
                  <div className="flex flex-wrap gap-2">{outras.map(cartao)}</div>
                </div>
              )}
              {ocupado && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!aRemover}
        onOpenChange={(o) => { if (!o) setARemover(null); }}
        title="Remover foto"
        description="A foto deixa de aparecer no atendimento. Ela fica registrada na auditoria e pode ser recuperada."
        onConfirm={() => { if (aRemover) remover.mutate(aRemover); setARemover(null); }}
        confirmLabel="Remover"
        variant="destructive"
      />
    </>
  );
}
