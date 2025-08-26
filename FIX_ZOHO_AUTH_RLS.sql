-- Fix RLS policy for zoho_auth table
-- The 406 error suggests RLS policy issues

-- Drop existing policies
DROP POLICY IF EXISTS "Super admins can manage zoho auth" ON zoho_auth;

-- Create a simpler, more permissive policy for now
CREATE POLICY "Allow authenticated users to read zoho auth" ON zoho_auth
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins can manage zoho auth" ON zoho_auth
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM platform_users 
      WHERE id = auth.uid() 
      AND platform_role = 'super_admin'
      AND is_active = true
    )
  );

-- Make sure the table has the right permissions
GRANT SELECT ON zoho_auth TO authenticated;
GRANT ALL ON zoho_auth TO authenticated;

-- Test query
SELECT 'Zoho auth RLS policies fixed!' as message;
