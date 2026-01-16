import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tractor, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { demoCredentials } from '@/data/mockData';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await login(email, password);
    
    if (result.success) {
      toast({ title: 'Login realizado com sucesso!' });
      navigate('/dashboard');
    } else {
      toast({ title: 'Erro no login', description: result.error, variant: 'destructive' });
    }
    
    setIsLoading(false);
  };

  const fillDemo = (role: 'admin' | 'operator') => {
    const creds = role === 'admin' ? demoCredentials.admin : demoCredentials.operator;
    setEmail(creds.email);
    setPassword(creds.password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary rounded-full p-3 w-fit mb-4">
            <Tractor className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Secretaria de Agricultura</CardTitle>
          <CardDescription>Sistema de Gestão de Demandas</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Entrar
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-muted-foreground text-center mb-3">Acessos de demonstração:</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => fillDemo('admin')}>Admin</Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => fillDemo('operator')}>Operador</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
