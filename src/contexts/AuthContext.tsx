import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '../lib/database.types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (emailOrPhone: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, phone?: string, role?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (authId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .maybeSingle();

    if (data) {
      setUser(data);
    }
    setLoading(false);
  };

  const signIn = async (emailOrPhone: string, password: string) => {
    let email = emailOrPhone;

    if (!emailOrPhone.includes('@')) {
      const { data: userData } = await supabase
        .from('users')
        .select('email')
        .eq('phone', emailOrPhone)
        .maybeSingle();

      if (!userData?.email) {
        throw new Error('Invalid credentials');
      }
      email = userData.email;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error('Invalid credentials');
    }

    if (data.user) {
      await loadUserProfile(data.user.id);
    }
  };

  const signUp = async (email: string, password: string, name: string, phone?: string, role: string = 'CUSTOMER') => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          phone,
          role,
        },
      },
    });

    if (error) {
      throw error;
    }

    if (data.user) {
      await loadUserProfile(data.user.id);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem('cart');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
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
