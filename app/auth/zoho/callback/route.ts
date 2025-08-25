import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  // If there's an error from Zoho
  if (error) {
    console.error('Zoho OAuth error:', error);
    const errorDescription = searchParams.get('error_description') || 'Authorization failed';
    
    // Redirect back to the Zoho setup page with error
    const redirectUrl = new URL('/settings/integrations/zoho-cliq', request.nextUrl.origin);
    redirectUrl.searchParams.set('error', errorDescription);
    
    return NextResponse.redirect(redirectUrl);
  }

  // If we have the authorization code
  if (code) {
    console.log('Received authorization code:', code);
    
    // Redirect back to the Zoho setup page with the code
    const redirectUrl = new URL('/settings/integrations/zoho-cliq', request.nextUrl.origin);
    redirectUrl.searchParams.set('code', code);
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }
    
    return NextResponse.redirect(redirectUrl);
  }

  // If neither code nor error, something went wrong
  console.error('No code or error received from Zoho');
  const redirectUrl = new URL('/settings/integrations/zoho-cliq', request.nextUrl.origin);
  redirectUrl.searchParams.set('error', 'Invalid response from Zoho');
  
  return NextResponse.redirect(redirectUrl);
}
