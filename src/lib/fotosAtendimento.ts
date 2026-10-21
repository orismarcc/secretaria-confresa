// Fotos de atendimento enviadas pela EQUIPE INTERNA (finalização pelo escritório
// ou depois, em "Editar fotos"). Vão para o mesmo lugar das fotos do operador:
// bucket service-photos + service_photos (etapa 'finish', sem GPS — a
// localização do atendimento continua sendo a registrada em campo).
import { supabase } from '@/integrations/supabase/client';

export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
export const LIMITE_FOTO_MB = 10;

/** Erro legível se a imagem não puder ser enviada; null se estiver ok. */
export function problemaFoto(f: File): string | null {
  if (!TIPOS_FOTO.includes(f.type)) return `"${f.name}": envie imagem JPG, PNG ou WEBP.`;
  if (f.size > LIMITE_FOTO_MB * 1024 * 1024) return `"${f.name}" tem mais de ${LIMITE_FOTO_MB} MB.`;
  return null;
}

/** Envia as fotos e registra no atendimento. Devolve quantas foram salvas. */
export async function enviarFotosAtendimento(serviceId: string, arquivos: File[], etapa = 'finish'): Promise<number> {
  let n = 0;
  for (const f of arquivos) {
    const erro = problemaFoto(f);
    if (erro) throw new Error(erro);
    const ext = f.type === 'image/png' ? 'png' : f.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${serviceId}/escritorio-${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('service-photos')
      .upload(path, f, { contentType: f.type, upsert: false });
    if (upErr) throw upErr;
    const { error } = await supabase.from('service_photos').insert({
      service_id: serviceId, storage_path: path, event_type: etapa, captured_at: new Date().toISOString(),
    } as any);
    if (error) { await supabase.storage.from('service-photos').remove([path]); throw error; }
    n++;
  }
  return n;
}
