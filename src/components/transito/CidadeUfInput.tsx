import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

/** "Confresa/MT" → { cidade: 'Confresa', uf: 'MT' }. Texto sem UF válida vira só cidade.
 *  Não apara espaços da cidade (o campo é editado ao vivo: "São " precisa sobreviver). */
export function parseCidadeUf(v?: string | null): { cidade: string; uf: string } {
  const s = v || '';
  const i = s.lastIndexOf('/');
  if (i >= 0) {
    const uf = s.slice(i + 1).trim().toUpperCase();
    if (UFS.includes(uf)) return { cidade: s.slice(0, i), uf };
  }
  return { cidade: s, uf: '' };
}

/** Monta "Cidade/UF" durante a edição (preserva UF mesmo sem cidade digitada). */
export function joinCidadeUf(cidade: string, uf: string): string {
  return uf ? `${cidade}/${uf}` : cidade;
}

/** Valor final para gravar: "Cidade/UF" aparado, ou null se não houver cidade. */
export function normalizeCidadeUf(v?: string | null): string | null {
  const { cidade, uf } = parseCidadeUf(v);
  const c = cidade.trim().replace(/\s+/g, ' ');
  if (!c) return null;
  return uf ? `${c}/${uf}` : c;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/** Campo Cidade + UF, com valor armazenado como "Cidade/UF". */
export function CidadeUfInput({ value, onChange, disabled, placeholder = 'Cidade' }: Props) {
  const { cidade, uf } = parseCidadeUf(value);
  return (
    <div className="flex gap-2">
      <Input
        className="flex-1 min-w-0"
        value={cidade}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(joinCidadeUf(e.target.value, uf))}
      />
      <Select value={uf || undefined} disabled={disabled} onValueChange={(v) => onChange(joinCidadeUf(cidade, v))}>
        <SelectTrigger className="w-[76px] shrink-0"><SelectValue placeholder="UF" /></SelectTrigger>
        <SelectContent>{UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
