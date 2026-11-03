// Redefinir senha de um colaborador que esqueceu a dele (os e-mails do sistema
// são internos, então não há "esqueci minha senha" por e-mail). Um admin pleno
// define uma senha PROVISÓRIA, passa à pessoa, e ela troca em Configurações.
// A ação fica na auditoria (sem a senha).
import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, Loader2 } from 'lucide-react';
import { useResetUserPassword } from '@/hooks/useOperatorData';

export function RedefinirSenhaDialog({ pessoa, onClose }: {
  pessoa: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const reset = useResetUserPassword();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => { setSenha(''); setConfirmacao(''); setErro(null); }, [pessoa?.id]);

  const salvar = async () => {
    if (!pessoa) return;
    setErro(null);
    if (senha.length < 8) { setErro('A senha deve ter pelo menos 8 caracteres.'); return; }
    if (senha !== confirmacao) { setErro('As senhas não conferem.'); return; }
    try {
      await reset.mutateAsync({ userId: pessoa.id, password: senha });
      onClose();
    } catch { /* aviso já exibido */ }
  };

  return (
    <Dialog open={!!pessoa} onOpenChange={(o) => { if (!o && !reset.isPending) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-amber-600" /> Redefinir senha
          </DialogTitle>
          <DialogDescription>
            Defina uma senha provisória para <strong>{pessoa?.name}</strong>. Passe a senha pessoalmente e peça
            para trocá-la em <strong>Configurações → Alterar Senha</strong> no primeiro acesso.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="senha-provisoria">Senha provisória</Label>
            <Input id="senha-provisoria" type="password" autoComplete="new-password" value={senha}
              onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo de 8 caracteres" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="senha-provisoria-2">Repita a senha</Label>
            <Input id="senha-provisoria-2" type="password" autoComplete="new-password" value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)} />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <p className="text-xs text-muted-foreground">Fica registrado na auditoria quem redefiniu e quando (a senha não é registrada).</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={reset.isPending}>Cancelar</Button>
          <Button onClick={salvar} disabled={reset.isPending} className="gap-2">
            {reset.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Redefinir senha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
