'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';
import { forceSignOut, validateSession } from '@/lib/auth-utils';
import { Button } from '@/components/ui/Button';

interface AuthDebuggerProps {
  show?: boolean;
}

export function AuthDebugger({ show = false }: AuthDebuggerProps) {
  const { user, platformUser, session, loading } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(show);

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          size="sm"
          variant="outline"
          className="bg-red-100 text-red-800 border-red-300"
        >
          🐛 Auth Debug
        </Button>
      </div>
    );
  }

  const checkAuthState = async () => {
    const supabase = createClient();
    
    try {
      const sessionResult = await supabase.auth.getSession();
      const userResult = await supabase.auth.getUser();
      const validationResult = await validateSession();
      
      const platformUserResult = platformUser ? 
        await supabase.from('platform_users').select('*').eq('id', user?.id).single() :
        { data: null, error: 'No user to check' };

      setDebugInfo({
        contextState: {
          user: !!user,
          userId: user?.id,
          platformUser: !!platformUser,
          platformUserId: platformUser?.id,
          session: !!session,
          loading
        },
        supabaseSession: {
          hasSession: !!sessionResult.data.session,
          sessionUserId: sessionResult.data.session?.user?.id,
          error: sessionResult.error?.message
        },
        supabaseUser: {
          hasUser: !!userResult.data.user,
          userId: userResult.data.user?.id,
          error: userResult.error?.message
        },
        platformUserDb: {
          exists: !!platformUserResult.data,
          error: platformUserResult.error
        },
        validation: validationResult,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      setDebugInfo({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleForceSignOut = async () => {
    await forceSignOut();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 max-w-md max-h-96 overflow-auto">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          🐛 Auth Debugger
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2 mb-4">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <strong>Context User:</strong> {user ? '✅' : '❌'}
          </div>
          <div>
            <strong>Platform User:</strong> {platformUser ? '✅' : '❌'}
          </div>
          <div>
            <strong>Session:</strong> {session ? '✅' : '❌'}
          </div>
          <div>
            <strong>Loading:</strong> {loading ? '⏳' : '✅'}
          </div>
        </div>

        {user && (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <strong>User ID:</strong> {user.id.slice(0, 8)}...
            <br />
            <strong>Email:</strong> {user.email}
            <br />
            <strong>Role:</strong> {platformUser?.platform_role || 'Unknown'}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Button
          onClick={checkAuthState}
          size="sm"
          fullWidth
          variant="outline"
        >
          Check Auth State
        </Button>

        <Button
          onClick={handleForceSignOut}
          size="sm"
          fullWidth
          variant="destructive"
        >
          Force Sign Out
        </Button>
      </div>

      {debugInfo && (
        <div className="mt-4 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs">
          <pre className="whitespace-pre-wrap overflow-auto max-h-40">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// Helper component to easily add to any page during development
export function AuthDebuggerDev() {
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return <AuthDebugger />;
}
