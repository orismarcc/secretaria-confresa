import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types';
import { tokenClockSkewSeconds, CLOCK_SKEW_LIMIT, CLOCK_WARN_KEY, clockWarnMessage } from '@/lib/clockSkew';

/** Aditivo/observacional: mede o relógio do aparelho e guarda um aviso p/ a tela
 *  de login, sem interferir na sessão. Nunca lança nem bloqueia. */
function checkClockSkew(session: Session | null) {
  try {
    const skew = tokenClockSkewSeconds(session?.access_token);
    if (skew != null && Math.abs(skew) > CLOCK_SKEW_LIMIT) {
      console.warn('[auth] relógio do aparelho fora do horário (skew s):', skew);
      sessionStorage.setItem(CLOCK_WARN_KEY, clockWarnMessage(skew));
    } else if (skew != null) {
      sessionStorage.removeItem(CLOCK_WARN_KEY);
    }
  } catch { /* jamais afeta o login */ }
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: { name: string; email: string; job_title?: string | null; avatar_url?: string | null } | null;
  role: UserRole | null;
  /** Coordenador = admin com cargo "Coordenador" (pode tudo, exceto excluir/alterar funções). */
  isCoordenador: boolean;
  /** Admin pleno (Secretário/Diretor/Supervisor) — acesso total, inclusive excluir. */
  isFullAdmin: boolean;
  /** Pode excluir registros (só admin pleno). */
  canDelete: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  updateProfile: (data: { name?: string; job_title?: string; avatar_url?: string | null }) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ name: string; email: string; job_title?: string | null; avatar_url?: string | null } | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Diagnóstico (observacional): ajuda a entender quedas de sessão em campo.
        console.debug('[auth] event:', event);
        checkClockSkew(session);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setIsLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      checkClockSkew(session);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('name, email, job_title, avatar_url').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('role, is_active').eq('user_id', userId).maybeSingle(),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
      }

      if (roleRes.data) {
        if (!roleRes.data.is_active) {
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setProfile(null);
          setRole(null);
          setIsLoading(false);
          return;
        }
        setRole(roleRes.data.role as UserRole);
      } else {
        const { data: bootstrapResult } = await supabase.rpc('bootstrap_first_admin', { _user_id: userId });
        if (bootstrapResult === true) {
          setRole('admin');
        }
      }
    } catch (err: unknown) {
      // A-04: nunca silenciar erro de carregamento de role/perfil — deixa o usuário
      // sem role e bloqueia toda a UI sem feedback. Logar para diagnóstico.
      console.error('[AuthContext] Falha ao carregar dados do usuário:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setIsLoading(false);
      const code = error.message?.toLowerCase() ?? '';
      if (code.includes('invalid login') || code.includes('invalid credentials') || code.includes('wrong password')) {
        return { success: false, error: 'Email ou senha incorretos.' };
      }
      if (code.includes('email not confirmed')) {
        return { success: false, error: 'Email não confirmado. Verifique sua caixa de entrada.' };
      }
      if (code.includes('too many requests') || code.includes('rate limit')) {
        return { success: false, error: 'Muitas tentativas. Aguarde alguns minutos.' };
      }
      return { success: false, error: 'Não foi possível fazer login. Tente novamente.' };
    }
    return { success: true };
  };

  const signUp = async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { name },
      },
    });
    if (error) {
      setIsLoading(false);
      const code = error.message?.toLowerCase() ?? '';
      if (code.includes('already registered') || code.includes('already exists')) {
        return { success: false, error: 'Este email já está cadastrado.' };
      }
      if (code.includes('weak password') || code.includes('password')) {
        return { success: false, error: 'Senha muito fraca. Use ao menos 6 caracteres.' };
      }
      return { success: false, error: 'Não foi possível criar a conta. Tente novamente.' };
    }
    setIsLoading(false);
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  const hasRole = (checkRole: UserRole): boolean => role === checkRole;

  const updateProfile = async (data: { name?: string; job_title?: string; avatar_url?: string | null }): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Usuário não autenticado.' };
    try {
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', user.id);
      if (error) throw error;
      // Refresh local profile state
      setProfile(prev => prev ? { ...prev, ...data } : prev);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: 'Não foi possível atualizar o perfil.' };
    }
  };

  const updatePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      return { success: false, error: 'Não foi possível alterar a senha.' };
    }
  };

  const isCoordenador = role === 'admin' && profile?.job_title === 'Coordenador';
  const isFullAdmin = role === 'admin' && !isCoordenador;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      role,
      isCoordenador,
      isFullAdmin,
      canDelete: isFullAdmin,
      isAuthenticated: !!user,
      isLoading,
      login,
      signUp,
      logout,
      hasRole,
      updateProfile,
      updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
