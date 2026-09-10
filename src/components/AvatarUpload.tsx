import { useRef, useState } from 'react';
import { Camera, Loader2, User as UserIcon } from 'lucide-react';
import { uploadAvatar } from '@/lib/avatar';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AvatarUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  size?: number;
  disabled?: boolean;
}

/** Foto de perfil clicável: mostra a imagem atual (ou ícone) e, ao clicar,
 *  escolhe/troca a foto — faz o upload na hora e devolve a URL via onChange. */
export function AvatarUpload({ value, onChange, size = 88, disabled }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const pick = () => { if (!disabled && !busy) inputRef.current?.click(); };

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Imagem muito grande', description: 'Máximo de 5 MB.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const url = await uploadAvatar(file);
    setBusy(false);
    if (url) onChange(url);
    else toast({ title: 'Falha ao enviar a foto', variant: 'destructive' });
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={pick}
        className={cn(
          'relative rounded-full overflow-hidden border-2 border-muted bg-muted flex items-center justify-center group',
          disabled ? 'cursor-default' : 'cursor-pointer hover:border-primary/50',
        )}
        style={{ width: size, height: size }}
        aria-label="Foto de perfil"
      >
        {value ? (
          <img src={value} alt="Foto de perfil" className="w-full h-full object-cover" />
        ) : (
          <UserIcon className="h-1/2 w-1/2 text-muted-foreground" />
        )}
        {!disabled && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            {busy ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
          </span>
        )}
        {busy && !value && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          </span>
        )}
      </button>
      {!disabled && (
        <div className="flex items-center gap-2 text-xs">
          <button type="button" onClick={pick} className="text-primary hover:underline" disabled={busy}>
            {value ? 'Trocar foto' : 'Adicionar foto'}
          </button>
          {value && (
            <button type="button" onClick={() => onChange(null)} className="text-destructive hover:underline" disabled={busy}>
              Remover
            </button>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
      />
    </div>
  );
}

/** Miniatura só de exibição (tabelas/listas). */
export function AvatarThumb({ url, size = 32 }: { url?: string | null; size?: number }) {
  return (
    <div
      className="rounded-full overflow-hidden bg-muted border flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <UserIcon className="h-1/2 w-1/2 text-muted-foreground" />
      )}
    </div>
  );
}
