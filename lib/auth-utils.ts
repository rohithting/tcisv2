import { createClient } from './supabase';

/**
 * Check if user has a valid session
 */
export async function checkSession() {
  const supabase = createClient();
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Session check error:', error);
      return { session: null, error };
    }

    return { session, error: null };
  } catch (error) {
    console.error('Session check failed:', error);
    return { session: null, error };
  }
}

/**
 * Refresh the current session
 */
export async function refreshSession() {
  const supabase = createClient();
  
  try {
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('Session refresh error:', error);
      return { session: null, error };
    }

    return { session: data.session, error: null };
  } catch (error) {
    console.error('Session refresh failed:', error);
    return { session: null, error };
  }
}

/**
 * Sign out and redirect to login
 */
export async function signOutAndRedirect() {
  const supabase = createClient();
  
  try {
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  } catch (error) {
    console.error('Sign out error:', error);
    // Force redirect even if sign out fails
    window.location.href = '/auth/login';
  }
}

/**
 * Force clear all auth state (useful when user is deleted from dashboard)
 */
export async function forceSignOut() {
  const supabase = createClient();
  
  try {
    // Clear the session
    await supabase.auth.signOut();
    
    // Clear any cached data
    localStorage.clear();
    sessionStorage.clear();
    
    // Force reload to clear any in-memory state
    window.location.href = '/auth/login';
  } catch (error) {
    console.error('Force sign out error:', error);
    // Clear storage and redirect anyway
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/auth/login';
  }
}

/**
 * Validate current session against server
 */
export async function validateSession() {
  const supabase = createClient();
  
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.log('No valid session found');
      return { valid: false, session: null };
    }

    // Validate the user still exists in auth
    const { data: authUser, error: userError } = await supabase.auth.getUser();
    
    if (userError || !authUser.user) {
      console.log('Auth user validation failed:', userError);
      await forceSignOut();
      return { valid: false, session: null };
    }

    return { valid: true, session };
  } catch (error) {
    console.error('Session validation error:', error);
    return { valid: false, session: null };
  }
}

/**
 * Check if user is on a protected route
 */
export function isProtectedRoute(pathname: string): boolean {
  const protectedPaths = ['/dashboard', '/unauthorized'];
  return protectedPaths.some(path => pathname.startsWith(path));
}

/**
 * Check if user is on an auth route
 */
export function isAuthRoute(pathname: string): boolean {
  return pathname.startsWith('/auth/');
}

/**
 * Get redirect URL after login
 */
export function getRedirectUrl(currentPath?: string): string {
  if (currentPath && isProtectedRoute(currentPath)) {
    return currentPath;
  }
  return '/dashboard';
}
