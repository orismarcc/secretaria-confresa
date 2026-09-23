import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { formatCpf } from '@/lib/documents';
import { AvatarUpload } from '@/components/AvatarUpload';

export interface OperatorDemandTypeOption {
  id: string;
  name: string;
}

const createSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
});

const editSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
});

interface OperatorMachineryOption {
  id: string;
  name: string;
}

interface OperatorSettlementOption {
  id: string;
  name: string;
}

interface OperatorGlebaOption {
  id: string;
  name: string;
  settlement_id: string;
}

interface OperatorFormProps {
  defaultValues?: { name: string; email?: string; cpf?: string; avatarUrl?: string | null };
  onSubmit: (
    data:
      | { name: string; email: string; password: string; cpf: string; avatarUrl: string | null; demandTypeIds: string[]; machineryIds: string[]; settlementIds: string[]; glebaIds: string[]; jobTitle?: string; cnhNumero?: string; cnhCategoria?: string; cnhValidade?: string }
      | { name: string; cpf: string; avatarUrl: string | null; demandTypeIds: string[]; machineryIds: string[]; settlementIds: string[]; glebaIds: string[]; jobTitle?: string; cnhNumero?: string; cnhCategoria?: string; cnhValidade?: string }
  ) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  mode: 'create' | 'edit';
  /** Se informado, mostra um seletor de "Função" (cargo) com estas opções. */
  roleOptions?: string[];
  /** Cargo pré-selecionado (quando roleOptions é usado). */
  initialRole?: string;
  /** Rótulo do botão de envio (sobrepõe o padrão). */
  submitLabel?: string;
  /** Tipos de serviço disponíveis para conceder acesso */
  demandTypes?: OperatorDemandTypeOption[];
  /** Tipos já atribuídos ao operador (modo edição) */
  initialDemandTypeIds?: string[];
  /** Maquinários disponíveis para vincular ao operador */
  machinery?: OperatorMachineryOption[];
  /** Maquinários já vinculados ao operador (modo edição) */
  initialMachineryIds?: string[];
  /** Assentamentos disponíveis para conceder acesso */
  settlements?: OperatorSettlementOption[];
  /** Assentamentos já atribuídos ao operador (modo edição) */
  initialSettlementIds?: string[];
  /** Glebas disponíveis (com o assentamento a que pertencem) */
  glebas?: OperatorGlebaOption[];
  /** Glebas já atribuídas ao operador (modo edição) */
  initialGlebaIds?: string[];
  /** CNH já cadastrada do operador (modo edição) */
  initialCnh?: { numero?: string | null; categoria?: string | null; validade?: string | null } | null;
}

export function OperatorForm({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading,
  mode,
  demandTypes = [],
  initialDemandTypeIds = [],
  machinery = [],
  initialMachineryIds = [],
  settlements = [],
  initialSettlementIds = [],
  glebas = [],
  initialGlebaIds = [],
  initialCnh,
  roleOptions,
  initialRole,
  submitLabel,
}: OperatorFormProps) {
  // Seletor de cargo (só quando roleOptions é informado — cadastro da equipe interna).
  const hasRoleSelect = (roleOptions?.length ?? 0) > 0;
  const [jobTitle, setJobTitle] = useState<string>(initialRole || roleOptions?.[0] || '');
  // Restrições (tipos/maquinário/assentamentos) só fazem sentido p/ Assistente de Campo.
  const showRestrictions = !hasRoleSelect || jobTitle === 'Assistente de Campo';
  const [name, setName] = useState(defaultValues?.name || '');
  const [email, setEmail] = useState(defaultValues?.email || '');
  const [cpf, setCpf] = useState(defaultValues?.cpf || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(defaultValues?.avatarUrl || null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [demandTypeIds, setDemandTypeIds] = useState<string[]>(initialDemandTypeIds);
  const [machineryIds, setMachineryIds] = useState<string[]>(initialMachineryIds);
  const [settlementIds, setSettlementIds] = useState<string[]>(initialSettlementIds);
  const [glebaIds, setGlebaIds] = useState<string[]>(initialGlebaIds);
  const [cnhNumero, setCnhNumero] = useState(initialCnh?.numero || '');
  const [cnhCategoria, setCnhCategoria] = useState(initialCnh?.categoria || '');
  const [cnhValidade, setCnhValidade] = useState((initialCnh?.validade || '').slice(0, 10));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleDemandType = (id: string) => {
    setDemandTypeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };
  const toggleMachinery = (id: string) => {
    setMachineryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };
  const toggleSettlement = (id: string) => {
    setSettlementIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      // Ao desmarcar um assentamento, remove também as glebas dele.
      if (prev.includes(id)) {
        const glebasDoAssent = new Set(glebas.filter((g) => g.settlement_id === id).map((g) => g.id));
        setGlebaIds((gs) => gs.filter((gid) => !glebasDoAssent.has(gid)));
      }
      return next;
    });
  };
  const toggleGleba = (id: string) => {
    setGlebaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (mode === 'create') {
      const result = createSchema.safeParse({ name, email, password, confirmPassword });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach(err => {
          if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
        });
        setErrors(fieldErrors);
        return;
      }
      await onSubmit({ name, email, password, cpf, avatarUrl, demandTypeIds, machineryIds, settlementIds, glebaIds, jobTitle: hasRoleSelect ? jobTitle : undefined, cnhNumero, cnhCategoria, cnhValidade });
    } else {
      const result = editSchema.safeParse({ name });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach(err => {
          if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
        });
        setErrors(fieldErrors);
        return;
      }
      await onSubmit({ name, cpf, avatarUrl, demandTypeIds, machineryIds, settlementIds, glebaIds, cnhNumero, cnhCategoria, cnhValidade });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <AvatarUpload value={avatarUrl} onChange={setAvatarUrl} />

      {hasRoleSelect && mode === 'create' && (
        <div className="space-y-2">
          <Label>Função (cargo)</Label>
          <Select value={jobTitle} onValueChange={setJobTitle}>
            <SelectTrigger><SelectValue placeholder="Selecione a função" /></SelectTrigger>
            <SelectContent>
              {roleOptions!.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Nome Completo</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do operador"
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="op-cpf">CPF</Label>
        <Input
          id="op-cpf"
          value={cpf}
          onChange={(e) => setCpf(formatCpf(e.target.value))}
          placeholder="000.000.000-00"
          inputMode="numeric"
        />
      </div>

      {mode === 'create' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className={errors.password ? 'border-destructive' : ''}
            />
            {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha"
              className={errors.confirmPassword ? 'border-destructive' : ''}
            />
            {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
          </div>
        </>
      )}

      {mode === 'edit' && defaultValues?.email && (
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={defaultValues.email} disabled className="bg-muted" />
          <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
        </div>
      )}

      {/* Tipos de serviço que o operador pode atender */}
      {showRestrictions && demandTypes.length > 0 && (
        <div className="space-y-2">
          <Label>Tipos de serviço com acesso</Label>
          <div className="max-h-44 overflow-y-auto rounded-md border p-2 space-y-1.5">
            {demandTypes.map((dt) => (
              <label
                key={dt.id}
                htmlFor={`dt-${dt.id}`}
                className="flex items-center gap-2.5 px-1.5 py-1 rounded hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  id={`dt-${dt.id}`}
                  checked={demandTypeIds.includes(dt.id)}
                  onCheckedChange={() => toggleDemandType(dt.id)}
                />
                <span className="text-sm">{dt.name}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {demandTypeIds.length === 0
              ? 'Nenhum selecionado — o operador terá acesso a todos os tipos.'
              : `${demandTypeIds.length} tipo(s) selecionado(s). O operador só verá esses no login.`}
          </p>
        </div>
      )}

      {/* Veículo(s)/maquinário(s) que o operador utiliza */}
      {showRestrictions && machinery.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Veículo / Maquinário utilizado</Label>
            <div className="flex items-center gap-2 text-xs">
              <button type="button" className="text-primary hover:underline" onClick={() => setMachineryIds(machinery.map((m) => m.id))}>
                Selecionar todos
              </button>
              <span className="text-muted-foreground">·</span>
              <button type="button" className="text-muted-foreground hover:underline" onClick={() => setMachineryIds([])}>
                Limpar
              </button>
            </div>
          </div>
          <div className="max-h-44 overflow-y-auto rounded-md border p-2 space-y-1.5">
            {machinery.map((m) => (
              <label
                key={m.id}
                htmlFor={`mach-${m.id}`}
                className="flex items-center gap-2.5 px-1.5 py-1 rounded hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  id={`mach-${m.id}`}
                  checked={machineryIds.includes(m.id)}
                  onCheckedChange={() => toggleMachinery(m.id)}
                />
                <span className="text-sm">{m.name}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {machineryIds.length === 0
              ? 'Opcional — registre o(s) maquinário(s) que este operador utiliza.'
              : `${machineryIds.length} maquinário(s) vinculado(s).`}
          </p>
        </div>
      )}

      {/* Assentamentos que o operador pode operar */}
      {showRestrictions && settlements.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Assentamentos com acesso</Label>
            <div className="flex items-center gap-2 text-xs">
              <button type="button" className="text-primary hover:underline" onClick={() => setSettlementIds(settlements.map((s) => s.id))}>
                Selecionar todos
              </button>
              <span className="text-muted-foreground">·</span>
              <button type="button" className="text-muted-foreground hover:underline" onClick={() => setSettlementIds([])}>
                Limpar
              </button>
            </div>
          </div>
          <div className="max-h-44 overflow-y-auto rounded-md border p-2 space-y-1.5">
            {settlements.map((s) => (
              <label
                key={s.id}
                htmlFor={`settl-${s.id}`}
                className="flex items-center gap-2.5 px-1.5 py-1 rounded hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  id={`settl-${s.id}`}
                  checked={settlementIds.includes(s.id)}
                  onCheckedChange={() => toggleSettlement(s.id)}
                />
                <span className="text-sm">{s.name}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {settlementIds.length === 0
              ? 'Nenhum selecionado — o operador poderá operar em todos os assentamentos.'
              : `${settlementIds.length} assentamento(s) selecionado(s). O operador só verá esses no login.`}
          </p>
        </div>
      )}

      {/* Glebas (opcional) — só para os assentamentos selecionados que têm glebas.
          Sem marcar nenhuma gleba de um assentamento = assentamento inteiro. */}
      {showRestrictions && settlementIds.some((sid) => glebas.some((g) => g.settlement_id === sid)) && (
        <div className="space-y-2">
          <Label>Glebas (opcional)</Label>
          <p className="text-xs text-muted-foreground -mt-1">
            Restrinja a glebas específicas. Sem marcar nenhuma de um assentamento, o operador opera o assentamento inteiro.
          </p>
          <div className="max-h-52 overflow-y-auto rounded-md border p-2 space-y-3">
            {settlementIds
              .map((sid) => ({ sid, sName: settlements.find((s) => s.id === sid)?.name || '', gs: glebas.filter((g) => g.settlement_id === sid) }))
              .filter((x) => x.gs.length > 0)
              .map(({ sid, sName, gs }) => (
                <div key={sid} className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{sName}</p>
                  {gs.map((g) => (
                    <label
                      key={g.id}
                      htmlFor={`gleba-${g.id}`}
                      className="flex items-center gap-2.5 px-1.5 py-1 rounded hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        id={`gleba-${g.id}`}
                        checked={glebaIds.includes(g.id)}
                        onCheckedChange={() => toggleGleba(g.id)}
                      />
                      <span className="text-sm">{g.name}</span>
                    </label>
                  ))}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* CNH (opcional) — usada para alertas de vencimento na Frota */}
      {!hasRoleSelect && (
        <div className="space-y-2">
          <Label>CNH (opcional)</Label>
          <div className="grid grid-cols-3 gap-2">
            <Input value={cnhNumero} onChange={(e) => setCnhNumero(e.target.value)} placeholder="Número" />
            <Input value={cnhCategoria} onChange={(e) => setCnhCategoria(e.target.value.toUpperCase())} placeholder="Categoria (ex.: D)" />
            <Input type="date" value={cnhValidade} onChange={(e) => setCnhValidade(e.target.value)} title="Validade" />
          </div>
          <p className="text-xs text-muted-foreground">A validade alimenta os alertas de vencimento de CNH na página de Frotas.</p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {mode === 'edit'
            ? 'Salvar'
            : hasRoleSelect
              ? `Criar ${jobTitle || 'membro'}`
              : (submitLabel || 'Criar Operador')}
        </Button>
      </div>
    </form>
  );
}
