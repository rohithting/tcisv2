import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/types/supabase';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  console.log('Auth callback route:', { code: !!code, error, errorDescription });

  if (error) {
    console.error('Auth callback error:', error, errorDescription);
    return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(errorDescription || 'Authentication failed')}`, request.url));
  }

  if (code) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

    try {
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      
      if (exchangeError) {
        console.error('Code exchange error:', exchangeError);
        return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent('Failed to verify email')}`, request.url));
      }

      if (data.session) {
        console.log('Session created successfully');
        
        // Check if user exists in platform_users
        const { data: platformUser, error: userError } = await supabase
          .from('platform_users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (userError && userError.code === 'PGRST116') {
          // User doesn't exist in platform_users, create them
          console.log('Creating platform user record');
          const { error: insertError } = await supabase
            .from('platform_users')
            .insert({
              id: data.user.id,
              email: data.user.email!,
              full_name: data.user.user_metadata?.full_name || '',
              platform_role: 'user'
            });

          if (insertError) {
            console.error('Error creating platform user:', insertError);
            // Don't fail the redirect, just log the error
          }
        }

        // Successful verification
        return NextResponse.redirect(new URL('/dashboard?verified=true', request.url));
      }
    } catch (error) {
      console.error('Auth callback route error:', error);
      return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent('Authentication failed')}`, request.url));
    }
  }

  // No code parameter
  return NextResponse.redirect(new URL('/auth/login', request.url));
}
