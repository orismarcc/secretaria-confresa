import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: { name: string; email: string; job_title?: string | null } | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  updateProfile: (data: { name?: string; job_title?: string }) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ name: string; email: string; job_title?: string | null } | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
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
        supabase.from('profiles').select('name, email, job_title').eq('id', userId).maybeSingle(),
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
    } catch {
      // silent
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

  const updateProfile = async (data: { name?: string; job_title?: string }): Promise<{ success: boolean; error?: string }> => {
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

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      role,
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
