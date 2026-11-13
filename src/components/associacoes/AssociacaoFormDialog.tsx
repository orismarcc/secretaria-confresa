// Cadastrar / editar associação, em seções com explicações curtas.
import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Handshake, Loader2 } from 'lucide-react';
import { useSalvarAssociacao, type AssociacaoEntrada } from '@/hooks/useAssociacoes';
import { useSettlements } from '@/hooks/useSupabaseData';
import { Ajuda, selectCls } from './comum';
import {
  SITUACOES_ASSOCIACAO, TIPOS_ASSOCIACAO, cnpjValido, formatarCnpj, soDigitos,
  type Associacao, type SituacaoAssociacao, type TipoAssociacao,
} from '@/lib/associacoes';

const vazio = (): AssociacaoEntrada => ({
  nome: '', sigla: null, cnpj: null, situacao: 'em_regularizacao', tipo: 'rural', data_fundacao: null, settlement_id: null,
  endereco: null, telefone: null, email: null, presidente_nome: null, presidente_telefone: null,
  mandato_inicio: null, mandato_fim: null, numero_associados: null, observacoes: null,
});

// Fora do componente: definido dentro, os campos perderiam o foco a cada letra.
function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-lg border p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</legend>
      {children}
    </fieldset>
  );
}

export function AssociacaoFormDialog({ aberto, associacao, existentes, onClose, onSalva }: {
  aberto: boolean;
  associacao: Associacao | null;
  existentes: Associacao[];
  onClose: () => void;
  onSalva?: (a: Associacao) => void;
}) {
  const salvar = useSalvarAssociacao();
  const { data: assentamentos = [] } = useSettlements();
  const [f, setF] = useState<AssociacaoEntrada>(vazio());
  const [cnpjTxt, setCnpjTxt] = useState('');

  useEffect(() => {
    if (!aberto) return;
    if (associacao) {
      const { id: _i, created_at: _c, updated_at: _u, ...resto } = associacao;
      setF(resto);
      setCnpjTxt(formatarCnpj(associacao.cnpj));
    } else { setF(vazio()); setCnpjTxt(''); }
  }, [aberto, associacao?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof AssociacaoEntrada>(k: K, v: AssociacaoEntrada[K]) => setF((x) => ({ ...x, [k]: v }));
  const txt = (k: keyof AssociacaoEntrada) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    set(k, (e.target.value || null) as never);

  const cnpj = soDigitos(cnpjTxt);
  const cnpjInvalido = cnpj.length > 0 && !cnpjValido(cnpj);
  const cnpjRepetido = cnpj.length === 14 && existentes.some((a) => a.cnpj === cnpj && a.id !== associacao?.id);
  const mandatoInvalido = !!f.mandato_inicio && !!f.mandato_fim && f.mandato_fim < f.mandato_inicio;
  const podeSalvar = f.nome.trim().length > 0 && !cnpjInvalido && !cnpjRepetido && !mandatoInvalido && !salvar.isPending;

  const gravar = async () => {
    if (!podeSalvar) return;
    try {
      const r = await salvar.mutateAsync({
        id: associacao?.id,
        dados: { ...f, nome: f.nome.trim(), cnpj: cnpj || null, numero_associados: f.numero_associados ?? null },
      });
      onClose();
      onSalva?.(r.assoc);
    } catch { /* aviso já exibido */ }
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o && !salvar.isPending) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Handshake className="h-5 w-5 text-primary" /> {associacao ? 'Editar associação' : 'Nova associação'}</DialogTitle>
          <DialogDescription>Só o nome é obrigatório. Os demais dados podem ser completados aos poucos.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Secao titulo="Identificação">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="as-nome">Nome da associação *</Label>
                <Input id="as-nome" value={f.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Ex.: Associação dos Produtores Rurais do PA Exemplo" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-sigla">Sigla</Label>
                <Input id="as-sigla" value={f.sigla ?? ''} onChange={txt('sigla')} placeholder="Ex.: APRE" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="as-cnpj">CNPJ</Label>
                <Input id="as-cnpj" inputMode="numeric" value={cnpjTxt} onChange={(e) => setCnpjTxt(formatarCnpj(e.target.value))}
                  placeholder="00.000.000/0000-00" aria-invalid={cnpjInvalido || cnpjRepetido} className={cnpjInvalido || cnpjRepetido ? 'border-destructive' : ''} />
                {cnpjInvalido && cnpj.length === 14 && <p className="text-xs text-destructive">CNPJ inválido (confira os números).</p>}
                {cnpjInvalido && cnpj.length < 14 && <p className="text-xs text-muted-foreground">Digite os 14 números.</p>}
                {cnpjRepetido && <p className="text-xs text-destructive">Já existe uma associação com este CNPJ.</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-tipo">Tipo</Label>
                <select id="as-tipo" value={f.tipo} onChange={(e) => set('tipo', e.target.value as TipoAssociacao)} className={selectCls}>
                  {TIPOS_ASSOCIACAO.map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">Situação
                <Ajuda titulo="Situação">É a situação de funcionamento informada pela equipe. A regularidade documental é calculada à parte, pelo checklist.</Ajuda>
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Situação">
                {SITUACOES_ASSOCIACAO.map((s) => (
                  <button key={s.id} type="button" role="radio" aria-checked={f.situacao === s.id} onClick={() => set('situacao', s.id as SituacaoAssociacao)}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors ${f.situacao === s.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}>
                    <span className="block text-sm font-medium">{s.rotulo}</span>
                    <span className="block text-xs text-muted-foreground">{s.ajuda}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="as-fund">Data de fundação</Label>
                <Input id="as-fund" type="date" value={f.data_fundacao ?? ''} onChange={txt('data_fundacao')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-assent">Assentamento / comunidade</Label>
                <select id="as-assent" value={f.settlement_id ?? ''} onChange={(e) => set('settlement_id', e.target.value || null)} className={selectCls}>
                  <option value="">—</option>
                  {(assentamentos as { id: string; name: string }[]).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-num">Nº de associados</Label>
                <Input id="as-num" inputMode="numeric" value={f.numero_associados ?? ''}
                  onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); set('numero_associados', d ? Number(d) : null); }} />
              </div>
            </div>
          </Secao>

          <Secao titulo="Diretoria">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="as-pres">Presidente</Label>
                <Input id="as-pres" value={f.presidente_nome ?? ''} onChange={txt('presidente_nome')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-pres-tel">Telefone do presidente</Label>
                <Input id="as-pres-tel" inputMode="tel" value={f.presidente_telefone ?? ''} onChange={txt('presidente_telefone')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="as-mi">Início do mandato</Label>
                <Input id="as-mi" type="date" value={f.mandato_inicio ?? ''} onChange={txt('mandato_inicio')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-mf" className="flex items-center gap-1.5">Fim do mandato
                  <Ajuda>O sistema avisa quando o mandato estiver perto de vencer — sem ata de eleição vigente, a associação fica irregular.</Ajuda>
                </Label>
                <Input id="as-mf" type="date" value={f.mandato_fim ?? ''} onChange={txt('mandato_fim')} aria-invalid={mandatoInvalido} />
              </div>
            </div>
            {mandatoInvalido && <p className="text-xs text-destructive">O fim do mandato deve ser depois do início.</p>}
          </Secao>

          <Secao titulo="Contato">
            <div className="space-y-1.5">
              <Label htmlFor="as-end">Endereço da sede</Label>
              <Input id="as-end" value={f.endereco ?? ''} onChange={txt('endereco')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="as-tel">Telefone</Label>
                <Input id="as-tel" inputMode="tel" value={f.telefone ?? ''} onChange={txt('telefone')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-email">E-mail</Label>
                <Input id="as-email" type="email" value={f.email ?? ''} onChange={txt('email')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-obs">Observações</Label>
              <Textarea id="as-obs" rows={2} value={f.observacoes ?? ''} onChange={txt('observacoes')} />
            </div>
          </Secao>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={salvar.isPending}>Cancelar</Button>
          <Button onClick={gravar} disabled={!podeSalvar}>
            {salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {associacao ? 'Salvar' : 'Cadastrar associação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
