import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Starting Zoho token auto-refresh job...')

    // Find tokens that need refreshing (expire within next 24 hours)
    const refreshThreshold = new Date(Date.now() + (24 * 60 * 60 * 1000)) // 24 hours from now
    
    const { data: authRecords, error: fetchError } = await supabase
      .from('zoho_auth')
      .select('*')
      .lt('expires_at', refreshThreshold.toISOString())
      .eq('auto_refresh_enabled', true)
      .not('refresh_token', 'is', null)
      .not('client_id', 'is', null)
      .not('client_secret', 'is', null)
      .lt('refresh_error_count', 5) // Don't retry if too many failures

    if (fetchError) {
      console.error('Error fetching auth records:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch auth records' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!authRecords || authRecords.length === 0) {
      console.log('No tokens need refreshing')
      return new Response(
        JSON.stringify({ message: 'No tokens need refreshing', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${authRecords.length} tokens that need refreshing`)

    const results = []

    for (const authRecord of authRecords) {
      try {
        console.log(`Refreshing token for auth ID: ${authRecord.id}`)

        // Update last refresh attempt
        await supabase
          .from('zoho_auth')
          .update({ last_refresh_attempt: new Date().toISOString() })
          .eq('id', authRecord.id)

        // Prepare refresh request
        const tokenUrl = 'https://accounts.zoho.in/oauth/v2/token'
        const formData = new URLSearchParams()
        formData.append('grant_type', 'refresh_token')
        formData.append('client_id', authRecord.client_id)
        formData.append('client_secret', authRecord.client_secret)
        formData.append('refresh_token', authRecord.refresh_token)

        // Make refresh request to Zoho
        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
        })

        const tokenData = await response.json()

        if (!response.ok || tokenData.error) {
          console.error(`Token refresh failed for ${authRecord.id}:`, tokenData)
          
          // Increment error count
          await supabase
            .from('zoho_auth')
            .update({ 
              refresh_error_count: (authRecord.refresh_error_count || 0) + 1 
            })
            .eq('id', authRecord.id)

          results.push({
            auth_id: authRecord.id,
            success: false,
            error: tokenData.error_description || tokenData.error || 'Unknown error'
          })
          continue
        }

        // Update database with new tokens
        const updateData: any = {
          access_token: tokenData.access_token,
          expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
          refresh_error_count: 0, // Reset error count on success
          updated_at: new Date().toISOString(),
        }

        // Only update refresh_token if we got a new one
        if (tokenData.refresh_token) {
          updateData.refresh_token = tokenData.refresh_token
        }

        const { error: updateError } = await supabase
          .from('zoho_auth')
          .update(updateData)
          .eq('id', authRecord.id)

        if (updateError) {
          console.error(`Failed to update tokens for ${authRecord.id}:`, updateError)
          results.push({
            auth_id: authRecord.id,
            success: false,
            error: 'Failed to save refreshed tokens'
          })
        } else {
          console.log(`Successfully refreshed tokens for ${authRecord.id}`)
          results.push({
            auth_id: authRecord.id,
            success: true,
            expires_at: updateData.expires_at,
            has_new_refresh_token: !!tokenData.refresh_token
          })
        }

      } catch (error) {
        console.error(`Error processing auth record ${authRecord.id}:`, error)
        results.push({
          auth_id: authRecord.id,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    console.log(`Auto-refresh completed: ${successCount} success, ${failureCount} failures`)

    return createCorsResponse({
      message: 'Auto-refresh completed',
      total_processed: results.length,
      success_count: successCount,
      failure_count: failureCount,
      results
    })

  } catch (error) {
    console.error('Auto-refresh job error:', error)
    return createCorsResponse({
      error: 'Auto-refresh job failed',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})
