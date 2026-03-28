import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: { name: string; email: string } | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer Supabase calls with setTimeout to avoid deadlock
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

    // THEN check for existing session
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
      // Fetch profile and role in parallel
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('name, email').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('role, is_active').eq('user_id', userId).maybeSingle(),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
      }

      if (roleRes.data) {
        // Check if user is active
        if (!roleRes.data.is_active) {
          // User is deactivated, log them out
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
        // No role found - check if this is the first user (bootstrap)
        const { data: bootstrapResult } = await supabase.rpc('bootstrap_first_admin', { _user_id: userId });
        
        if (bootstrapResult === true) {
          // User was promoted to admin
          setRole('admin');
        }
      }
    } catch {
      // silent — errors surface via Supabase auth state
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setIsLoading(false);
      // Map Supabase error codes to safe user-facing messages
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
      // Generic fallback — never expose raw Supabase error
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

  const hasRole = (checkRole: UserRole): boolean => {
    return role === checkRole;
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
