import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'teacher' | 'student' | 'school' | 'parent';
  school_id: string | null;
  school_name: string | null;
  profile_image_url: string | null;
  phone: string | null;
  bio: string | null;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('portal_users')
        .select('id, email, full_name, role, school_id, school_name, profile_image_url, phone, bio, is_active')
        .eq('id', userId)
        .single();
      if (data) setProfile(data as UserProfile);
    } catch {
      // Network error — profile stays null, safety timeout handles loading state
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    // Safety timeout — if Supabase never fires or network is unavailable,
    // release the loading gate after 6 seconds so the app is usable.
    const safetyTimer = setTimeout(() => setLoading(false), 6000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      clearTimeout(safetyTimer);
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // fetchProfile with its own 5s timeout so a slow DB never hangs the app
        const profileTimer = setTimeout(() => setLoading(false), 5000);
        fetchProfile(s.user.id).finally(() => {
          clearTimeout(profileTimer);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
