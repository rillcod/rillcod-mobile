import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { AuthContextType, UserProfile } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeAuthError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'Incorrect email or password.';
  if (lower.includes('email not confirmed')) return 'Please confirm your email before signing in.';
  if (lower.includes('network')) return 'Network issue detected. Check your connection and try again.';
  return message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAuthState = useCallback(() => {
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('portal_users')
        .select('id, email, full_name, role, school_id, school_name, profile_image_url, phone, bio, is_active')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        const nextProfile = data as UserProfile;
        setProfile(nextProfile);
        return nextProfile;
      }

      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData.user;

      if (!authUser || authUser.id !== userId) {
        setProfile(null);
        return null;
      }

      await supabase.from('portal_users').upsert({
        id: userId,
        email: authUser.email ?? '',
        full_name: authUser.user_metadata?.full_name ?? authUser.email?.split('@')[0] ?? '',
        role: (authUser.user_metadata?.role ?? 'student') as UserProfile['role'],
        school_id: null,
        school_name: null,
        profile_image_url: null,
        phone: null,
        bio: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'id' });

      const { data: repairedProfile, error: repairedError } = await supabase
        .from('portal_users')
        .select('id, email, full_name, role, school_id, school_name, profile_image_url, phone, bio, is_active')
        .eq('id', userId)
        .maybeSingle();

      if (repairedError || !repairedProfile) {
        setProfile(null);
        return null;
      }

      const nextProfile = repairedProfile as UserProfile;
      setProfile(nextProfile);
      return nextProfile;
    } catch {
      setProfile(null);
      return null;
    }
  }, []);

  const stampLastLogin = useCallback(async (userId: string) => {
    try {
      await supabase
        .from('portal_users')
        .update({ last_login: new Date().toISOString() } as any)
        .eq('id', userId);
    } catch {
      // Non-blocking.
    }
  }, []);

  const applySession = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      setProfile(null);
      return;
    }

    const nextProfile = await fetchProfile(nextSession.user.id);

    if (!nextProfile) {
      await supabase.auth.signOut();
      clearAuthState();
      return;
    }

    if (!nextProfile.is_active) {
      await supabase.auth.signOut();
      clearAuthState();
      return;
    }

    await stampLastLogin(nextSession.user.id);
  }, [clearAuthState, fetchProfile, stampLastLogin]);

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    let mounted = true;
    const safetyTimer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 6000);

    const bootstrap = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          if (error.message.includes('refresh_token_not_found') || error.message.includes('invalid refresh token')) {
            await supabase.auth.signOut();
            clearAuthState();
          }
          if (!mounted) return;
          return;
        }
        if (!mounted) return;
        await applySession(data.session ?? null);
      } catch (err) {
        console.warn('Auth bootstrap failed:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrap().finally(() => clearTimeout(safetyTimer));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;
      await applySession(nextSession);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    // Do not toggle global `loading` here: AppNavigator gates the whole tree on it and would
    // unmount LoginScreen, wiping field/error state and feeling like a "refresh" on failure.
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: normalizeAuthError(error.message) };

      const signedUser = data.user;
      if (!signedUser) {
        return { error: 'Unable to establish a session. Please try again.' };
      }

      const nextProfile = await fetchProfile(signedUser.id);
      if (!nextProfile) {
        await supabase.auth.signOut();
        clearAuthState();
        return { error: 'Your account profile is missing. Please contact support.' };
      }

      if (!nextProfile.is_active) {
        await supabase.auth.signOut();
        clearAuthState();
        return { error: 'Your account is pending approval. Please wait for activation.' };
      }

      await stampLastLogin(signedUser.id);
      return { error: null };
    } catch {
      return { error: 'Something went wrong. Please try again.' };
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      const { error: globalError } = await supabase.auth.signOut({ scope: 'global' });
      if (globalError) {
        const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
        if (localError) {
          console.warn('Sign out failed:', localError);
        }
      }
    } catch (error) {
      try {
        const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
        if (localError) {
          console.warn('Sign out fallback failed:', localError);
        }
      } catch (fallbackError) {
        console.warn('Sign out fallback threw:', fallbackError);
      }
      console.warn('Global sign out failed:', error);
    } finally {
      clearAuthState();
      setLoading(false);
    }
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
