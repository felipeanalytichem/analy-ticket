import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/integrations/supabase/types';
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog';

type UserProfile = Tables<'users'> & {
  must_change_password?: boolean;
  temporary_password_expires_at?: string | null;
};

interface AuthContextType {
  user: SupabaseUser | null;
  userProfile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  isInitialized: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string, role?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  fixUserEmail: (correctEmail: string) => Promise<{ error: Error | null }>;
  cleanupAuthConflicts: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [authError, setAuthError] = useState<Error | null>(null);

  // Helper function to create profile for orphan auth accounts
  const createProfileForOrphanAuth = async (userId: string, email: string) => {
    try {
      console.log(`Creating profile for user: ${userId} (${email})`);
      
      const profileData = {
        id: userId,
        email: email,
        full_name: email.split('@')[0] || 'User',
        role: 'user' as const
      };
      
      // Check if there's already a user with this email
      const { data: existingByEmail, error: emailCheckError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (emailCheckError) {
        console.error('Error checking existing email:', emailCheckError);
        return null;
      }
        
      if (existingByEmail) {
        console.log('Email already exists in database, using existing profile');
        return existingByEmail;
      }
      
      const { data: newProfile, error: insertError } = await supabase
        .from('users')
        .upsert(profileData, { onConflict: 'id' })
        .select()
        .single();
        
      if (insertError) {
        console.error('Error creating profile:', insertError);
        return null;
      }
      
      console.log('Profile created successfully');
      return newProfile;
    } catch (error) {
      console.error('Error in createProfileForOrphanAuth:', error);
      return null;
    }
  };

  // Check if user needs to change password
  const checkPasswordChangeRequired = useCallback((profile: UserProfile | null) => {
    if (!profile || !profile.must_change_password) return;
    
    if (profile.temporary_password_expires_at) {
      const expiryDate = new Date(profile.temporary_password_expires_at);
      const now = new Date();
      
      if (expiryDate > now) {
        console.log('Temporary password is still valid, showing change dialog');
        setShowChangePasswordDialog(true);
      } else {
        console.log('Temporary password expired, showing urgent change dialog');
        setShowChangePasswordDialog(true);
      }
    } else {
      console.log('User must change password, showing change dialog');
      setShowChangePasswordDialog(true);
    }
  }, []);

  // Helper function to load or create user profile
  const loadUserProfile = useCallback(async (userId: string, userEmail?: string): Promise<boolean> => {
    try {
      console.log(`🔐 Loading profile for user: ${userId}`);
      
      const { data: profile, error: selectError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
      if (selectError) {
        console.error('🔐 Error fetching profile:', selectError);
        
        if (userEmail) {
          console.log('🔐 Creating profile due to fetch error...');
          const newProfile = await createProfileForOrphanAuth(userId, userEmail);
          if (newProfile) {
            setUserProfile(newProfile);
            checkPasswordChangeRequired(newProfile);
            return true;
          }
        }
        console.error('🔐 Failed to load or create profile');
        return false;
      }
      
      if (profile) {
        console.log('🔐 Profile found and loaded successfully');
        setUserProfile(profile);
        checkPasswordChangeRequired(profile);
        return true;
      } else if (userEmail) {
        console.log('🔐 Profile not found, creating new one...');
        const newProfile = await createProfileForOrphanAuth(userId, userEmail);
        if (newProfile) {
          setUserProfile(newProfile);
          checkPasswordChangeRequired(newProfile);
          return true;
        }
        console.error('🔐 Failed to create new profile');
      } else {
        console.error('🔐 No profile found and no email provided to create one');
      }
      
      return false;
    } catch (error) {
      console.error('🔐 Exception in loadUserProfile:', error);
      return false;
    }
  }, [checkPasswordChangeRequired]);

  // Initialize authentication
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        console.log('🔐 Initializing authentication...');
        setLoading(true);
        setAuthError(null);

        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          if (mounted) {
            setAuthError(sessionError);
            setLoading(false);
            setInitialized(true);
          }
          return;
        }
        
        if (currentSession && mounted) {
          console.log('🔐 Session found, loading user profile...');
          setSession(currentSession);
          setUser(currentSession.user);
          
          const profileLoaded = await loadUserProfile(currentSession.user.id, currentSession.user.email || undefined);
          
          if (!profileLoaded && mounted) {
            console.log('Profile load failed, continuing without profile');
            setAuthError(new Error('Failed to load user profile'));
          }
        } else {
          console.log('🔐 No session found');
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setAuthError(error as Error);
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setInitialized(true);
          console.log('🔐 Authentication initialization complete');
        }
      }
    };

    initAuth();

    return () => {
      mounted = false;
    };
  }, [loadUserProfile]);

  // Listen for auth changes
  useEffect(() => {
    if (!initialized) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`Auth state change: ${event}`);
      
      // For token refresh events, just update session
      if (event === 'TOKEN_REFRESHED') {
        setSession(session);
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        try {
          await loadUserProfile(session.user.id, session.user.email || undefined);
        } catch (error) {
          console.error('🔐 Error loading profile:', error);
          setAuthError(error as Error);
        }
      } else {
        setUserProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initialized, loadUserProfile]);

  // Sign in implementation
  const signIn = async (email: string, password: string) => {
    console.log(`[Sign-In Attempt] Email: ${email}, Password: ${password}`);
    try {
      setLoading(true);
      setAuthError(null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign-in error:', error.message);
        setAuthError(error);
        return { error };
      }

      if (data.user) {
        console.log('User signed in, loading profile...');
        setSession(data.session);
        setUser(data.user);
        
        const profileLoaded = await loadUserProfile(data.user.id, data.user.email);
        if (!profileLoaded) {
           const profileError = new Error('Failed to load user profile after sign-in.');
           setAuthError(profileError);
           return { error: profileError };
        }
      }
      
      return { error: null };
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error('An unknown error occurred');
      console.error('Unexpected sign-in error:', typedError);
      setAuthError(typedError);
      return { error: typedError };
    } finally {
      setLoading(false);
    }
  };

  // Sign up implementation
  const signUp = async (email: string, password: string, name: string, role: string = 'user') => {
    try {
      setLoading(true);
      setAuthError(null);
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            role,
          },
        },
      });

      if (error) throw error;
      
      return { error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      setAuthError(error as Error);
      return { error: error as Error };
    } finally {
      setLoading(false);
    }
  };

  // Sign out implementation
  const signOut = async () => {
    try {
      console.log('🚪 Starting sign out process...');
      setLoading(true);
      
      // Clear Supabase auth session
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Supabase signOut error:', error);
        throw error;
      }
      
      // Clear local state
      setUser(null);
      setUserProfile(null);
      setSession(null);
      setAuthError(null);
      
      // Force clear any remaining auth tokens from localStorage
      try {
        // Clear all possible Supabase auth keys
        const authStorageKey = 'sb-plbmgjqitlxedsmdqpld-auth-token';
        localStorage.removeItem(authStorageKey);
        localStorage.removeItem('supabase.auth.token');
        
        // Clear any other auth-related keys
        Object.keys(localStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('auth') || key.includes('session')) {
            localStorage.removeItem(key);
          }
        });
        
        sessionStorage.clear();
        console.log('🧹 Cleared all local storage auth data');
      } catch (storageError) {
        console.warn('Error clearing storage:', storageError);
      }
      
      console.log('✅ Sign out completed successfully');
      
      // Force navigation to login page after a short delay
      setTimeout(() => {
        if (window.location.pathname !== '/login') {
          console.log('🔄 Redirecting to login page...');
          window.location.href = '/login';
        }
      }, 100);
      
    } catch (error) {
      console.error('❌ Sign out error:', error);
      setAuthError(error as Error);
      
      // Even if there's an error, try to clear local state and redirect
      setUser(null);
      setUserProfile(null);
      setSession(null);
      
      setTimeout(() => {
        if (window.location.pathname !== '/login') {
          console.log('🔄 Force redirecting to login page after error...');
          window.location.href = '/login';
        }
      }, 100);
    } finally {
      setLoading(false);
    }
  };

  // Fix for the missing fixUserEmail function
  const fixUserEmail = async (correctEmail: string) => {
    try {
      if (!user) throw new Error('No user logged in');
      
      const { error } = await supabase
        .from('users')
        .update({ email: correctEmail })
        .eq('id', user.id);
        
      if (error) throw error;
      
      setUserProfile(prev => prev ? { ...prev, email: correctEmail } : null);
      return { error: null };
    } catch (error) {
      console.error('Fix email error:', error);
      return { error: error as Error };
    }
  };

  // Fix for the missing cleanupAuthConflicts function
  const cleanupAuthConflicts = async () => {
    try {
      console.log('Starting auth cleanup...');
      
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession) {
        console.log('No session found during cleanup');
        return { error: new Error('No session found') };
      }
      
      const profileLoaded = await loadUserProfile(currentSession.user.id, currentSession.user.email || undefined);
      
      if (profileLoaded) {
        setSession(currentSession);
        setUser(currentSession.user);
        console.log('Auth cleanup successful');
        return { error: null };
      } else {
        console.log('Auth cleanup failed');
        return { error: new Error('Could not load profile after cleanup') };
      }
    } catch (error) {
      console.error('Error during auth cleanup:', error);
      return { error: error as Error };
    }
  };

  const value = {
    user,
    userProfile,
    session,
    loading,
    isInitialized: initialized,
    signIn,
    signUp,
    signOut,
    updateProfile: async (updates) => {
      try {
        if (!user) throw new Error('No user logged in');
        
        const { error } = await supabase
          .from('users')
          .update(updates)
          .eq('id', user.id);
          
        if (error) throw error;
        
        setUserProfile(prev => prev ? { ...prev, ...updates } : null);
        return { error: null };
      } catch (error) {
        console.error('Update profile error:', error);
        return { error: error as Error };
      }
    },
    fixUserEmail,
    cleanupAuthConflicts,
  };

  // Add data-testid for testing
  return (
    <AuthContext.Provider value={value}>
      <div data-testid="auth-initialized">
        {children}
      </div>
      {showChangePasswordDialog && (
        <ChangePasswordDialog
          isOpen={showChangePasswordDialog}
          onClose={() => setShowChangePasswordDialog(false)}
          userEmail={user?.email || ''}
        />
      )}
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