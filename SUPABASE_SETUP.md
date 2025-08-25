# Supabase Setup Guide for TCIS

This guide will walk you through setting up Supabase for the TCIS authentication system.

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `ting-tcis-v2`
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
5. Click "Create new project"

## 2. Get Project Credentials

Once your project is ready:

1. Go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (NEXT_PUBLIC_SUPABASE_URL)
   - **anon public** key (NEXT_PUBLIC_SUPABASE_ANON_KEY)

## 3. Configure Authentication

### Email Settings
1. Go to **Authentication** → **Settings**
2. Under **SMTP Settings**:
   - Enable custom SMTP (optional, for production)
   - Or use Supabase's default for development

### URL Configuration
1. In **Authentication** → **URL Configuration**:
   - **Site URL**: `http://localhost:3000` (for development)
   - **Redirect URLs**: Add these URLs:
     ```
     http://localhost:3000/auth/callback
     http://localhost:3000/auth/reset-password
     https://your-domain.com/auth/callback (for production)
     https://your-domain.com/auth/reset-password (for production)
     ```

### Email Templates
1. Go to **Authentication** → **Email Templates**
2. Customize the templates:

#### Confirm Signup Template:
```html
<h2>Welcome to ting TCIS!</h2>
<p>Thank you for signing up. Please click the link below to verify your email address:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
<p>If you didn't create an account, you can safely ignore this email.</p>
```

#### Reset Password Template:
```html
<h2>Reset your ting TCIS password</h2>
<p>Someone requested a password reset for your ting TCIS account.</p>
<p><a href="{{ .ConfirmationURL }}">Reset your password</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>
```

## 4. Run Database Migrations

1. Go to **SQL Editor** in your Supabase dashboard
2. Run the migrations in order:

### Step 1: Reset Database
Copy and paste the contents of `supabase/migrations/001_complete_reset.sql` and execute it.

### Step 2: Create Schema
Copy and paste the contents of `supabase/migrations/002_complete_schema.sql` and execute it.

## 5. Enable Row Level Security

The migrations automatically enable RLS, but verify:

1. Go to **Table Editor**
2. For each table, ensure RLS is enabled (shield icon should be green)

## 6. Create Your First Super Admin

After running migrations and setting up your environment:

1. Sign up through your app at `http://localhost:3000/auth/signup`
2. Confirm your email
3. Go to **Table Editor** → **platform_users**
4. Find your user record and update the `platform_role` to `'super_admin'`

Or run this SQL:
```sql
UPDATE platform_users 
SET platform_role = 'super_admin' 
WHERE email = 'your-admin-email@ting.in';
```

## 7. Environment Configuration

Create your `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Platform Configuration
NEXT_PUBLIC_PLATFORM_NAME=TCIS
NEXT_PUBLIC_PLATFORM_LOGO_URL=/logo.png
NEXT_PUBLIC_FAVICON_URL=/favicon.ico
NEXT_PUBLIC_PRIMARY_COLOR=#ffe600
NEXT_PUBLIC_SECONDARY_COLOR=#000000

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_SIGNUPS=false
NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=true
```

## 8. Test Authentication Flow

1. **Signup**: Try creating a new account
2. **Email Verification**: Check email and click verification link
3. **Login**: Test login with verified account
4. **Password Reset**: Test forgot password flow
5. **Role Access**: Verify role-based dashboard access

## 9. Production Setup

For production deployment:

1. **Update URLs**: Change all localhost URLs to your domain
2. **SMTP**: Configure custom SMTP for reliable email delivery
3. **SSL**: Ensure all URLs use HTTPS
4. **Environment**: Update environment variables for production

## 10. Security Checklist

- ✅ RLS enabled on all tables
- ✅ Proper policies configured
- ✅ Email verification enabled
- ✅ Strong database password
- ✅ Redirect URLs properly configured
- ✅ API keys secured in environment variables

## Troubleshooting

### Common Issues:

1. **"Invalid login credentials"**
   - Check if email is confirmed
   - Verify RLS policies allow user access

2. **Email not received**
   - Check spam folder
   - Verify SMTP configuration
   - Check email template configuration

3. **Redirect errors**
   - Ensure all redirect URLs are added to Supabase
   - Check URL configuration matches your domain

4. **Database errors**
   - Verify migrations ran successfully
   - Check RLS policies are not blocking access
   - Ensure user has proper role assignments

### Support

For issues with TCIS setup, contact the development team or check the main README.md for additional troubleshooting steps.
