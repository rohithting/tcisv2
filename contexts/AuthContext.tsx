'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase';
import { PlatformUser, PlatformRole } from '@/types/database';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  platformUser: PlatformUser | null;
  session: Session | null;
  loading: boolean;
  supabase: any;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  hasRole: (role: PlatformRole) => boolean;
  hasAnyRole: (roles: PlatformRole[]) => boolean;
  refreshUser: () => Promise<void>;
  ensureValidToken: () => Promise<string | null>;
  validateSession: () => Promise<boolean>;
  ensureValidSession: () => Promise<boolean>;
  lazyAuthenticate: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [platformUser, setPlatformUser] = useState<PlatformUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();
  const isProcessingVisibilityChange = useRef(false);

  // Fetch platform user data and validate session
  const fetchPlatformUser = async (userId: string) => {
    try {
      // First, validate that the auth user still exists
      const { data: authUser, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser.user || authUser.user.id !== userId) {
        console.error('Auth user validation failed in fetchPlatformUser');
        return null;
      }

      const { data, error } = await supabase
        .from('platform_users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching platform user:', error);
        
        if (error.code === 'PGRST116') {
          console.log('Platform user not found, creating manually...');
          
          try {
            const { error: insertError } = await supabase
              .from('platform_users')
              .insert({
                id: userId,
                email: authUser.user.email!,
                full_name: authUser.user.user_metadata?.full_name || '',
                platform_role: 'user'
              });

            if (insertError) {
              console.error('Direct insert failed:', insertError);
              return null;
            }

            console.log('Platform user created successfully');
            return {
              id: userId,
              email: authUser.user.email!,
              full_name: authUser.user.user_metadata?.full_name || '',
              platform_role: 'user' as const,
              is_active: true,
              last_login_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
          } catch (creationError: any) {
            console.error('Error in platform user creation:', creationError);
            return null;
          }
        }
        
        return null;
      }

      return data;
    } catch (error: any) {
      console.error('Error in fetchPlatformUser:', error);
      return null;
    }
  };

  // Force clear session and redirect
  const forceClearSession = async () => {
    console.log('Force clearing session - user does not exist');
    
    try {
      await supabase.auth.signOut();
    } catch (error: any) {
      console.error('Error during signOut:', error);
    }

    setUser(null);
    setSession(null);
    setPlatformUser(null);
    setLoading(false);

    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (error: any) {
      console.error('Error clearing storage:', error);
    }

    router.push('/auth/login');
  };

  // FIXED: Enhanced session validation function
  const validateSession = useCallback(async (): Promise<boolean> => {
    if (!session || !user) {
      return false;
    }

    try {
      console.log('Validating current session...');
      
      // Get fresh session data - don't rely on cached data
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.log('Session validation error:', error);
        return false;
      }
      
      if (!currentSession) {
        console.log('Session validation failed - no current session');
        return false;
      }
      
      // Check if user ID matches
      if (currentSession.user.id !== user.id) {
        console.log('Session validation failed - user ID mismatch');
        return false;
      }
      
      // Check if token is expired or expiring soon
      const now = Math.floor(Date.now() / 1000);
      const tokenExp = currentSession.expires_at || 0;
      const timeUntilExpiry = tokenExp - now;
      
      console.log(`Token expires in ${timeUntilExpiry} seconds`);
      
      if (timeUntilExpiry <= 0) {
        console.log('Session validation failed - token expired');
        return false;
      }
      
      // Update local session if it differs from server
      if (currentSession.access_token !== session.access_token) {
        console.log('Updating local session with server session');
        setSession(currentSession);
        setUser(currentSession.user);
      }
      
      return true;
    } catch (error: any) {
      console.error('Session validation error:', error);
      return false;
    }
  }, [session, user, supabase.auth]);

  // FIXED: Enhanced lazyAuthenticate function
  const lazyAuthenticate = async (): Promise<boolean> => {
    console.log('lazyAuthenticate called - START');
    
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => {
        reject(new Error('lazyAuthenticate timeout after 5 seconds'));
      }, 5000);
    });
    
    const authPromise = (async () => {
      try {
        console.log('Step 1: Getting current session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('Step 1 COMPLETE - Session check result:', { hasSession: !!session, error: !!error });
        
        if (error || !session) {
          console.log('No session found during lazy auth - RETURNING FALSE');
          return false;
        }

        console.log('Step 2: Checking token expiry...');
        const now = Math.floor(Date.now() / 1000);
        const tokenExp = session.expires_at || 0;
        const timeUntilExpiry = tokenExp - now;
        
        console.log('Step 2 COMPLETE - Token expiry check:', { 
          now, 
          tokenExp, 
          timeUntilExpiry, 
          needsRefresh: timeUntilExpiry < 300 
        });
        
        if (timeUntilExpiry < 300) { // 5 minutes buffer
          console.log('Step 3: Token expiring soon, starting refresh...');
          
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          console.log('Step 3 COMPLETE - Refresh result:', { 
            hasRefreshData: !!refreshData?.session, 
            hasError: !!refreshError,
            errorMessage: refreshError?.message 
          });
          
          if (refreshError || !refreshData.session) {
            console.log('Token refresh failed during lazy auth - RETURNING FALSE');
            return false;
          }
          
          console.log('Step 4: Updating local state...');
          setSession(refreshData.session);
          setUser(refreshData.session.user);
          
          console.log('Step 4 COMPLETE - Token refreshed successfully during lazy auth - RETURNING TRUE');
          return true;
        }

        console.log('Token is healthy, no refresh needed - RETURNING TRUE');
        return true;
      } catch (error: any) {
        console.error('Error in lazyAuthenticate:', error);
        return false;
      } finally {
        console.log('lazyAuthenticate called - END');
      }
    })();
    
    try {
      const result = await Promise.race([authPromise, timeoutPromise]);
      return result;
    } catch (timeoutError) {
      console.error('lazyAuthenticate TIMEOUT:', timeoutError);
      return false;
    }
  };

  // FIXED: Add visibility change handler for tab switching
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && user && session && !isProcessingVisibilityChange.current) {
        console.log('Tab became visible, validating session...');
        
        try {
          // Set flag to prevent unnecessary auth state updates during visibility change
          isProcessingVisibilityChange.current = true;
          
          // Use lazyAuthenticate when tab becomes visible
          const isValid = await lazyAuthenticate();
          
          if (!isValid) {
            console.log('Session invalid after tab switch, clearing session...');
            setSession(null);
            setUser(null);
            setPlatformUser(null);
            router.push('/auth/login');
          } else {
            console.log('Session valid after tab switch');
          }
        } catch (error) {
          console.error('Error validating session after tab switch:', error);
          // Don't force logout on validation errors, just log them
        } finally {
          // Clear the flag after processing is complete
          isProcessingVisibilityChange.current = false;
        }
      }
    };

    // Add event listener for tab switching
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, session, router, lazyAuthenticate]);

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;
    let hasInitialized = false;

    const initializeAuth = async () => {
      if (hasInitialized || !isMounted) return;
      hasInitialized = true;

      try {
        console.log('Initializing auth state...');
        
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (sessionError) {
          console.error('Session error during init - redirecting to login');
          if (isMounted) {
            setLoading(false);
            router.push('/auth/login');
          }
          return;
        }
        
        if (initialSession?.user) {
          console.log('Initial session found, setting up auth state...');
          
          if (isMounted) {
            setUser(initialSession.user);
            setSession(initialSession);
          }
          
          try {
            const platformUserData = await fetchPlatformUser(initialSession.user.id);
            
            if (!isMounted) return;
            
            if (platformUserData) {
              if (isMounted) {
                setPlatformUser(platformUserData);
              }
              
              try {
                await supabase
                  .from('platform_users')
                  .update({ last_login_at: new Date().toISOString() })
                  .eq('id', initialSession.user.id);
              } catch (error: any) {
                console.error('Error updating last login');
              }
            } else {
              console.log('Platform user not found during init, but keeping session');
            }
          } catch (error: any) {
            console.error('Error fetching platform user during init, but keeping session');
          }
        } else {
          console.log('No initial session found - redirecting to login');
          if (isMounted) {
            setLoading(false);
            router.push('/auth/login');
          }
        }
      } catch (error: any) {
        console.error('Error initializing auth');
        if (isMounted) {
          setLoading(false);
          router.push('/auth/login');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const initTimeout = setTimeout(() => {
      if (isMounted && hasInitialized === false) {
        console.log('Auth initialization timeout, forcing completion...');
        hasInitialized = true;
        setLoading(false);
      }
    }, 10000);

    initializeAuth();

    return () => {
      isMounted = false;
      clearTimeout(initTimeout);
    };
  }, []);

    // Listen for auth state changes
  useEffect(() => {
    let isInitialLoad = true;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change detected:', event);
        
        // Skip processing if this is a visibility change event
        if (isProcessingVisibilityChange.current) {
          console.log('Skipping auth state change - processing visibility change');
          return;
        }
        
        if (event === 'SIGNED_IN' && isInitialLoad) {
          isInitialLoad = false;
          return;
        }
        
        isInitialLoad = false;
        
        if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          setSession(null);
          setUser(null);
          setPlatformUser(null);
          return;
        }

        if (event === 'TOKEN_REFRESHED' && !session) {
          console.log('Token refresh failed - session expired');
          setSession(null);
          setUser(null);
          setPlatformUser(null);
          
          const currentPath = window.location.pathname;
          if (currentPath.startsWith('/dashboard') || currentPath.startsWith('/unauthorized')) {
            router.push('/auth/login');
          }
          return;
        }

        if (session?.user) {
          // Check if the session actually changed before updating state
          const hasSessionChanged = !user || 
            user.id !== session.user.id || 
            session.access_token !== (session?.access_token || '') ||
            session.refresh_token !== (session?.refresh_token || '') ||
            session.expires_at !== (session?.expires_at || 0);
          
          if (hasSessionChanged) {
            console.log('Processing auth session update - session changed');
            setSession(session);
            setUser(session.user);
            
            try {
              const platformUserData = await fetchPlatformUser(session.user.id);
              
              if (platformUserData) {
                console.log('Platform user validated successfully');
                setPlatformUser(platformUserData);
              } else {
                console.log('Platform user not found in state change, but keeping session');
              }
            } catch (error: any) {
              console.error('Error fetching platform user in state change, but keeping session');
            }
          } else {
            console.log('Skipping auth session update - no actual changes detected');
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth, router, user, session, isProcessingVisibilityChange]);

  // Expose validation function for components to use when needed
  const ensureValidSession = async (): Promise<boolean> => {
    const isValid = await validateSession();
    if (!isValid) {
      setSession(null);
      setUser(null);
      setPlatformUser(null);
      router.push('/auth/login');
    }
    return isValid;
  };

  // Sign in
  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      toast.success('Successfully signed in!');
      router.push('/dashboard');
      return {};
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      return { error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Sign up
  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user && !data.user.email_confirmed_at) {
        toast.success('Please check your email to confirm your account!');
        router.push('/auth/verify-email?email=' + encodeURIComponent(email));
      } else {
        toast.success('Account created successfully!');
        router.push('/dashboard');
      }

      return {};
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      return { error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setPlatformUser(null);
      setSession(null);
      toast.success('Signed out successfully!');
      router.push('/auth/login');
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast.error('Error signing out');
    } finally {
      setLoading(false);
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        return { error: error.message };
      }

      toast.success('Password reset email sent!');
      return {};
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      return { error: errorMessage };
    }
  };

  // Update password
  const updatePassword = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        return { error: error.message };
      }

      toast.success('Password updated successfully!');
      router.push('/dashboard');
      return {};
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      return { error: errorMessage };
    }
  };

  // Role checking functions
  const hasRole = (role: PlatformRole): boolean => {
    return platformUser?.platform_role === role;
  };

  const hasAnyRole = (roles: PlatformRole[]): boolean => {
    return platformUser ? roles.includes(platformUser.platform_role) : false;
  };

  // Refresh user data
  const refreshUser = async () => {
    if (user) {
      const platformUserData = await fetchPlatformUser(user.id);
      setPlatformUser(platformUserData);
    }
  };

  // FIXED: Enhanced ensureValidToken function
  const ensureValidToken = async () => {
    try {
      console.log('Ensuring valid token...');
      
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting session for token refresh:', error);
        return null;
      }

      if (!session?.access_token) {
        console.log('No access token found');
        return null;
      }

      // Check if token is expiring soon (within 5 minutes)
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at || 0;
      const timeUntilExpiry = expiresAt - now;

      if (timeUntilExpiry < 300) { // 5 minutes buffer
        console.log('Token expiring soon, refreshing...');
        
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData.session) {
          console.error('Token refresh failed:', refreshError);
          return null;
        }

        console.log('Token refreshed successfully');
        setSession(refreshData.session);
        setUser(refreshData.session.user);
        
        return refreshData.session.access_token;
      }

      return session.access_token;
    } catch (error: any) {
      console.error('Error in ensureValidToken:', error);
      return null;
    }
  };

  // Cleanup and error recovery
  useEffect(() => {
    const cleanup = () => {
      // Clear any pending operations
    };

    const handleError = (error: Error) => {
      console.error('Auth context error:', error);
      
      if (error.message.includes('auth') || error.message.includes('session')) {
        console.log('Attempting to recover from auth error...');
        
        setTimeout(async () => {
          try {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (currentSession?.user) {
              setUser(currentSession.user);
              setSession(currentSession);
              setLoading(false);
            } else {
              setUser(null);
              setSession(null);
              setPlatformUser(null);
              setLoading(false);
              router.push('/auth/login');
            }
          } catch (recoveryError) {
            console.error('Error recovery failed:', recoveryError);
            setUser(null);
            setSession(null);
            setPlatformUser(null);
            setLoading(false);
            router.push('/auth/login');
          }
        }, 1000);
      }
    };

    const errorHandler = (event: ErrorEvent) => handleError(event.error);
    const rejectionHandler = (event: PromiseRejectionEvent) => handleError(new Error(event.reason));

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);

    return () => {
      cleanup();
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
    };
  }, [supabase.auth, router]);

  const value: AuthContextType = {
    user,
    platformUser,
    session,
    loading,
    supabase,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    hasRole,
    hasAnyRole,
    refreshUser,
    ensureValidToken,
    validateSession,
    ensureValidSession,
    lazyAuthenticate,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}