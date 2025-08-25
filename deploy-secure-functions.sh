#!/bin/bash

# Deploy Secure Edge Functions
# This script deploys all Edge Functions with the new secure authentication system

echo "🔒 Deploying Secure Edge Functions..."
echo "======================================"

# Set your Supabase project reference
PROJECT_REF="brohvgsykwmcefsjkbit"

# Deploy all functions
echo "📦 Deploying clients-create function..."
supabase functions deploy clients-create --project-ref $PROJECT_REF

echo "📦 Deploying rooms-create function..."
supabase functions deploy rooms-create --project-ref $PROJECT_REF

echo "📦 Deploying conversations-create function..."
supabase functions deploy conversations-create --project-ref $PROJECT_REF

echo "📦 Deploying upload-url function..."
supabase functions deploy upload-url --project-ref $PROJECT_REF

echo "📦 Deploying ingest function..."
supabase functions deploy ingest --project-ref $PROJECT_REF

echo "📦 Deploying jobs function..."
supabase functions deploy jobs --project-ref $PROJECT_REF

echo "📦 Deploying job-retry function..."
supabase functions deploy job-retry --project-ref $PROJECT_REF

echo "📦 Deploying feedback function..."
supabase functions deploy feedback --project-ref $PROJECT_REF

echo "📦 Deploying reindex function..."
supabase functions deploy reindex --project-ref $PROJECT_REF

echo "📦 Deploying query function..."
supabase functions deploy query --project-ref $PROJECT_REF

echo ""
echo "✅ All Secure Edge Functions deployed successfully!"
echo ""
echo "🔐 Security Features Enabled:"
echo "   • JWT-based authentication (no more anon key vulnerabilities)"
echo "   • Role-based access control"
echo "   • Client-specific permissions"
echo "   • Platform admin privileges"
echo ""
echo "📋 Next Steps:"
echo "   1. Run the database migration: supabase db push"
echo "   2. Test authentication with admin@yourcompany.com / adminpassword123"
echo "   3. Update your frontend to use JWT tokens"
echo "   4. Remove any hardcoded anon keys from your code"
