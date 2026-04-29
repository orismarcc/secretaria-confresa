import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { User, KeyRound, Save, Eye, EyeOff, Download, Smartphone, CheckCircle2 } from 'lucide-react';
import { AVIPrestacaoContas } from '@/components/AVIPrestacaoContas';

const JOB_TITLES = [
  'Secretário de Agricultura',
  'Diretor de Campo',
  'Coordenador',
  'Supervisor',
];

export default function SettingsPage() {
  const { profile, updateProfile, updatePassword } = useAuth();
  const { toast } = useToast();
  const { canInstall, isInstalled, install } = usePWAInstall();

  // Personal data state
  const [name, setName] = useState(profile?.name || '');
  const [jobTitle, setJobTitle] = useState(profile?.job_title || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast({ title: 'Nome é obrigatório.', variant: 'destructive' });
      return;
    }
    setSavingProfile(true);
    const result = await updateProfile({ name: name.trim(), job_title: jobTitle || undefined });
    setSavingProfile(false);
    if (result.success) {
      toast({ title: 'Dados atualizados com sucesso!' });
    } else {
      toast({ title: result.error || 'Erro ao atualizar dados.', variant: 'destructive' });
    }
  };

  const handleSavePassword = async () => {
    if (!newPassword) {
      toast({ title: 'Digite a nova senha.', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'A senha deve ter pelo menos 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'As senhas não coincidem.', variant: 'destructive' });
      return;
    }
    setSavingPassword(true);
    const result = await updatePassword(newPassword);
    setSavingPassword(false);
    if (result.success) {
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Senha alterada com sucesso!' });
    } else {
      toast({ title: result.error || 'Erro ao alterar senha.', variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Configurações"
        description="Gerencie seus dados pessoais e segurança da conta"
      />

      <div className="max-w-2xl space-y-6">
        {/* Personal Data Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-5 w-5 text-primary" />
              Dados Pessoais
            </CardTitle>
            <CardDescription>
              Atualize seu nome e função dentro da secretaria
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile?.email || ''}
                disabled
                className="bg-muted text-muted-foreground cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">O email não pode ser alterado.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobTitle">Função</Label>
              <Select value={jobTitle} onValueChange={setJobTitle}>
                <SelectTrigger id="jobTitle">
                  <SelectValue placeholder="Selecione sua função" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TITLES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full sm:w-auto">
              <Save className="h-4 w-4 mr-2" />
              {savingProfile ? 'Salvando...' : 'Salvar dados'}
            </Button>
          </CardContent>
        </Card>

        {/* PWA Install Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="h-5 w-5 text-primary" />
              Instalar Aplicativo
            </CardTitle>
            <CardDescription>
              Adicione o app à tela inicial para acesso rápido, sem precisar abrir o navegador
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isInstalled ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <span className="text-sm text-green-800 dark:text-green-300">
                  Aplicativo já instalado na tela inicial.
                </span>
              </div>
            ) : canInstall ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Clique abaixo para adicionar à tela inicial do seu dispositivo.
                </p>
                <Button onClick={install} className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Adicionar à tela inicial
                </Button>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-sm text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-medium">Prompt automático não disponível agora.</p>
                <p className="text-xs">
                  Se acabou de desinstalar, aguarde alguns minutos e recarregue a página. Use as instruções manuais abaixo.
                </p>
              </div>
            )}

            {/* Manual install instructions — always visible */}
            {!isInstalled && (
              <div className="space-y-3 pt-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Instalação manual</p>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-3 items-start">
                    <span className="text-base">🤖</span>
                    <div>
                      <p className="font-medium">Android (Chrome)</p>
                      <p className="text-muted-foreground text-xs">Menu ⋮ → "Adicionar à tela inicial"</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <span className="text-base">🍎</span>
                    <div>
                      <p className="font-medium">iPhone / iPad (Safari)</p>
                      <p className="text-muted-foreground text-xs">Botão compartilhar ⎋ → "Adicionar à Tela Inicial"</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prestação de Contas / AVI Card */}
        <AVIPrestacaoContas />

        {/* Password Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-5 w-5 text-primary" />
              Alterar Senha
            </CardTitle>
            <CardDescription>
              Escolha uma senha segura com pelo menos 6 caracteres
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova senha</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Nova senha"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNew(v => !v)}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirm(v => !v)}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-sm text-destructive">As senhas não coincidem.</p>
            )}

            <Separator />

            <Button onClick={handleSavePassword} disabled={savingPassword} className="w-full sm:w-auto">
              <KeyRound className="h-4 w-4 mr-2" />
              {savingPassword ? 'Alterando...' : 'Alterar senha'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
