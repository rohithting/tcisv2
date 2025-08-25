# Apply Database Migrations

## Quick Start (If you have Docker running)

To apply all migrations including the signup fix and Zoho integration:

```bash
# Reset and apply all migrations
supabase db reset

# Or apply specific migrations
supabase db push
```

## Manual Migration (If Docker isn't available)

If Docker Desktop isn't running, you can apply the migrations manually in your Supabase dashboard:

### 1. Fix Signup Flow (Priority 1)
Execute this SQL in your Supabase SQL Editor:

```sql
-- Copy and paste the entire content of:
-- supabase/migrations/009_fix_signup_trigger.sql
```

### 2. Enable Zoho Integration (Priority 2)
Execute these SQL files in order in your Supabase SQL Editor:

```sql
-- First, copy and paste the entire content of:
-- supabase/migrations/008_zoho_cliq_integration.sql

-- Then, copy and paste the entire content of:
-- supabase/migrations/010_fix_zoho_room_id_type.sql
```

**Note**: Migration 010 fixes a type mismatch issue in migration 008. If you get an error about incompatible types when applying 008, just apply 010 which recreates the tables with correct types.

## Current Status

- ✅ **Rooms page fixed** - Now works with graceful fallback for missing Zoho tables
- ✅ **Signup flow migration ready** - Will fix the platform user creation error
- ✅ **Zoho integration ready** - Will enable all Zoho features when applied

## Testing Signup

After applying migration 009:
1. Try signing up a new user
2. Check that platform_users table gets populated
3. Verify no errors in Supabase logs

## Testing Zoho Integration

After applying migration 008:
1. Go to Settings → Integrations → Zoho Cliq (super admin only)
2. Set up OAuth credentials
3. Map channels in client rooms pages
4. Test automated sync functionality

## Verification

After applying migrations, check these tables exist:
- `platform_users` (should already exist)
- `zoho_auth` (new)
- `zoho_channel_mappings` (new)
- `zoho_sync_jobs` (new)

And these functions exist:
- `create_platform_user()` (fixed)
- `handle_new_user()` (fixed)
