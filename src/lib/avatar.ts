import { supabase } from '@/integrations/supabase/client';

/**
 * Envia uma foto de perfil ao bucket privado 'avatars' e devolve uma URL
 * assinada de longa duração (10 anos) — mesmo padrão dos comprovantes de DAM.
 */
export async function uploadAvatar(file: File): Promise<string | null> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: true });
  if (error) {
    console.error('avatar upload error:', error);
    return null;
  }
  const { data } = await supabase.storage.from('avatars').createSignedUrl(path, 60 * 60 * 24 * 3650);
  return data?.signedUrl ?? null;
}
