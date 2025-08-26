import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    console.log('Zoho callback received:', { code: !!code, error, state });

    // Return an HTML page that sends a message to the parent window
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Zoho OAuth Callback</title>
</head>
<body>
    <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
        <h2>Processing authorization...</h2>
        <p>You can close this window.</p>
    </div>
    <script>
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const error = urlParams.get('error');
            const errorDescription = urlParams.get('error_description');

            if (window.opener) {
                if (error) {
                    console.error('OAuth error:', error);
                    window.opener.postMessage({
                        type: 'ZOHO_OAUTH_ERROR',
                        error: errorDescription || error
                    }, window.location.origin);
                } else if (code) {
                    console.log('Sending authorization code to parent');
                    window.opener.postMessage({
                        type: 'ZOHO_OAUTH_SUCCESS',
                        code: code,
                        state: urlParams.get('state')
                    }, window.location.origin);
                } else {
                    window.opener.postMessage({
                        type: 'ZOHO_OAUTH_ERROR',
                        error: 'No authorization code received'
                    }, window.location.origin);
                }
                
                // Close the popup after a short delay
                setTimeout(() => {
                    window.close();
                }, 1000);
            } else {
                console.log('No opener window found - redirecting to setup page');
                // If not opened as popup, redirect to the setup page with the code
                if (code) {
                    window.location.href = '/settings/integrations/zoho-cliq?code=' + encodeURIComponent(code);
                } else if (error) {
                    window.location.href = '/settings/integrations/zoho-cliq?error=' + encodeURIComponent(errorDescription || error);
                } else {
                    window.location.href = '/settings/integrations/zoho-cliq?error=No authorization code received';
                }
            }
        } catch (err) {
            console.error('Error in callback script:', err);
            if (window.opener) {
                window.opener.postMessage({
                    type: 'ZOHO_OAUTH_ERROR',
                    error: 'Callback processing failed'
                }, window.location.origin);
            }
        }
    </script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
    
  } catch (err) {
    console.error('Error in Zoho callback:', err);
    return new NextResponse('Callback processing failed', { status: 500 });
  }
}
