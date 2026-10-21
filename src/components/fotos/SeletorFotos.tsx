// Escolher fotos (câmera ou galeria) com miniaturas, antes de salvar.
// Não envia nada: quem usa decide quando enviar (ex.: ao finalizar).
import { useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ImagePlus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { problemaFoto } from '@/lib/fotosAtendimento';

export function SeletorFotos({ fotos, onChange, rotulo = 'Adicionar fotos (opcional)' }: {
  fotos: File[];
  onChange: (fotos: File[]) => void;
  rotulo?: string;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const urls = useMemo(() => fotos.map((f) => URL.createObjectURL(f)), [fotos]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const aoEscolher = (e: React.ChangeEvent<HTMLInputElement>) => {
    const novos = Array.from(e.target.files ?? []);
    e.target.value = '';
    const validos: File[] = [];
    novos.forEach((f) => {
      const erro = problemaFoto(f);
      if (erro) toast({ title: 'Foto não adicionada', description: erro, variant: 'destructive' });
      else validos.push(f);
    });
    if (validos.length) onChange([...fotos, ...validos]);
  };

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={aoEscolher} />
      {fotos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fotos.map((f, i) => (
            <div key={`${f.name}-${i}`} className="relative h-20 w-20 overflow-hidden rounded-md border bg-muted">
              <img src={urls[i]} alt={f.name} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(fotos.filter((_, k) => k !== i))}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                title="Tirar esta foto"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => inputRef.current?.click()}>
        <ImagePlus className="h-4 w-4" /> {fotos.length ? 'Adicionar mais fotos' : rotulo}
      </Button>
    </div>
  );
}
