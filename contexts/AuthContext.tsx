/**
 * Authentication Context
 * Provides authentication state and methods throughout the application
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseService';
import { logger } from '../services/loggingService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ user: User | null; error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ user: User | null; error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        logger.error('Error getting initial session', 'auth', error);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (_event === 'SIGNED_IN') {
        logger.info('User signed in', 'auth', { userId: session?.user?.id });
      } else if (_event === 'SIGNED_OUT') {
        logger.info('User signed out', 'auth');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        logger.error('Error signing up', 'auth', error);
        return { user: null, error };
      }

      if (data.user) {
        logger.info('User signed up successfully', 'auth', { userId: data.user.id });
      }

      return { user: data.user, error: null };
    } catch (error) {
      const authError = error instanceof Error ? error : new Error(String(error));
      logger.error('Unexpected error during sign up', 'auth', authError);
      return { user: null, error: authError as AuthError };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logger.error('Error signing in', 'auth', error);
        return { user: null, error };
      }

      if (data.user) {
        logger.info('User signed in successfully', 'auth', { userId: data.user.id });
      }

      return { user: data.user, error: null };
    } catch (error) {
      const authError = error instanceof Error ? error : new Error(String(error));
      logger.error('Unexpected error during sign in', 'auth', authError);
      return { user: null, error: authError as AuthError };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.error('Error signing out', 'auth', error);
        throw error;
      }
      logger.info('User signed out successfully', 'auth');
    } catch (error) {
      logger.error('Unexpected error during sign out', 'auth', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        logger.error('Error resetting password', 'auth', error);
        return { error };
      }

      logger.info('Password reset email sent', 'auth', { email });
      return { error: null };
    } catch (error) {
      const authError = error instanceof Error ? error : new Error(String(error));
      logger.error('Unexpected error during password reset', 'auth', authError);
      return { error: authError as AuthError };
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        logger.error('Error updating password', 'auth', error);
        return { error };
      }

      logger.info('Password updated successfully', 'auth');
      return { error: null };
    } catch (error) {
      const authError = error instanceof Error ? error : new Error(String(error));
      logger.error('Unexpected error during password update', 'auth', authError);
      return { error: authError as AuthError };
    }
  }, []);

  const value: AuthContextType = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access the Authentication context.
 * 
 * Provides authentication state and methods for user authentication.
 * Must be used within an AuthProvider.
 * 
 * @returns {AuthContextType} The authentication context containing:
 * - user: Current authenticated user (null if not authenticated)
 * - session: Current session (null if not authenticated)
 * - loading: Whether authentication state is being checked
 * - signUp: Register a new user account
 * - signIn: Sign in with email and password
 * - signOut: Sign out the current user
 * - resetPassword: Send password reset email
 * - updatePassword: Update the current user's password
 * 
 * @throws {Error} If used outside of an AuthProvider
 * 
 * @example
 * ```typescript
 * const { user, signIn, signOut, loading } = useAuth();
 * 
 * // Sign in
 * const { user, error } = await signIn('user@example.com', 'password');
 * 
 * // Sign out
 * await signOut();
 * 
 * // Check if user is authenticated
 * if (user) {
 *   console.log('User is authenticated:', user.email);
 * }
 * ```
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
