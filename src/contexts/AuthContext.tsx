import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '../lib/database.types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (phone: string, password: string) => Promise<void>;
  signUp: (name: string, phone: string, email?: string, password?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const signIn = async (phone: string, password: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .eq('password', password)
      .maybeSingle();

    if (error || !data) {
      throw new Error('Invalid credentials');
    }

    setUser(data);
    localStorage.setItem('user', JSON.stringify(data));
  };

  const signUp = async (name: string, phone: string, email?: string, password?: string) => {
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (existingUser) {
      throw new Error('Phone number already registered');
    }

    const { data, error } = await supabase
      .from('users')
      .insert({
        role: 'CUSTOMER',
        name,
        phone,
        email: email || null,
        password: password || null,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error('Failed to create account');
    }

    setUser(data);
    localStorage.setItem('user', JSON.stringify(data));
  };

  const signOut = async () => {
    setUser(null);
    localStorage.removeItem('user');
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
