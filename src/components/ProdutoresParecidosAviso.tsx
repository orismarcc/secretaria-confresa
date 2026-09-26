// Aviso (não bloqueia) de cadastros parecidos no formulário de produtor.
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useProdutoresParecidos } from '@/hooks/useSupabaseData';

function useDebounced<T>(valor: T, ms = 500): T {
  const [v, setV] = useState(valor);
  useEffect(() => { const t = setTimeout(() => setV(valor), ms); return () => clearTimeout(t); }, [valor, ms]);
  return v;
}

export function ProdutoresParecidosAviso({ nome, cpf, telefone, settlementId, ignorarId, ativo }: {
  nome: string; cpf?: string; telefone?: string; settlementId?: string; ignorarId?: string; ativo: boolean;
}) {
  const params = useDebounced({ nome: nome || '', cpf, telefone, settlementId, ignorarId });
  const { data = [] } = useProdutoresParecidos(params, ativo);
  if (!ativo || data.length === 0) return null;

  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
      <p className="font-medium flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" /> Já existe cadastro parecido
      </p>
      <ul className="mt-1.5 space-y-0.5 text-xs">
        {data.map((p) => (
          <li key={p.id}>
            <span className="font-semibold">{p.name}</span>
            {p.settlement_name ? ` — ${p.settlement_name}` : ''} <span className="opacity-80">({p.motivo})</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] opacity-90">
        Confira se não é a mesma pessoa. Se for, use o cadastro existente (ou unifique pela ficha do produtor).
      </p>
    </div>
  );
}
