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
              Adicione o app à tela inicial do seu celular para acesso rápido
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isInstalled ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                <span>O aplicativo já está instalado na tela inicial do seu dispositivo.</span>
              </div>
            ) : canInstall ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Instale para acessar sem precisar abrir o navegador, receber notificações e usar offline.
                </p>
                <Button onClick={install} className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Adicionar à tela inicial
                </Button>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  O botão de instalação aparece automaticamente quando o navegador libera o prompt.
                </p>
                <p className="text-xs">
                  Caso já tenha desinstalado recentemente, o Chrome pode levar alguns minutos para disponibilizar o prompt novamente. Recarregue a página após alguns instantes.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

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
