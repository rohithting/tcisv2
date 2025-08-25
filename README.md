# ting TCIS V2 - Chat Insight System

A comprehensive platform for deriving actionable insights from WhatsApp and Zoho Cliq chat exports using AI-powered analysis.

## 🚀 Features

- **Multi-Role Authentication System**
  - Super Admin: Complete platform control
  - Backend: Full view access, can manage clients (no delete)
  - Admin: Client-specific admin with complete control
  - Manager: Can initiate chats and conversations for specific clients
  - User: No client access (contact admin for assignment)

- **Modern UI/UX**
  - Light/Dark mode support
  - 100% mobile responsive design
  - ting brand colors (#ffe600 primary)
  - American Typewriter heading font

- **Comprehensive Chat Analysis**
  - Upload WhatsApp/Zoho Cliq exports (TXT, CSV, JSON)
  - AI-powered parsing and chunking
  - Vector embeddings for semantic search
  - RAG-based query system with evaluation drivers

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS with custom ting branding
- **Authentication**: Supabase Auth with role-based access control
- **Database**: PostgreSQL with pgvector for embeddings
- **Icons**: Heroicons

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- PostgreSQL database with pgvector extension

## 🚀 Quick Start

### 1. Clone and Install

\`\`\`bash
git clone <your-repo-url>
cd "Ting TCIS V2"
npm install
\`\`\`

### 2. Environment Setup

Create \`.env.local\` file:

\`\`\`env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

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
\`\`\`

### 3. Database Setup

1. Run the reset migration first:
   \`\`\`bash
   # In Supabase SQL Editor
   # Execute: supabase/migrations/001_complete_reset.sql
   \`\`\`

2. Then run the complete schema:
   \`\`\`bash
   # In Supabase SQL Editor  
   # Execute: supabase/migrations/002_complete_schema.sql
   \`\`\`

3. Enable Row Level Security (RLS) in Supabase dashboard for all tables

### 4. Create Super Admin

After running migrations, manually create your first super admin:

\`\`\`sql
-- First, sign up through the app or Supabase Auth
-- Then update the user's role:
UPDATE platform_users 
SET platform_role = 'super_admin' 
WHERE email = 'your-admin-email@ting.in';
\`\`\`

### 5. Run Development Server

\`\`\`bash
npm run dev
\`\`\`

Visit [http://localhost:3000](http://localhost:3000)

## 🔐 Role-Based Access Control

### Super Admin
- Complete platform control
- Manage all users and roles
- Access to admin settings
- Platform-wide analytics

### Backend
- View all clients and data
- Create and update clients (cannot delete)
- Manage chat groups across clients
- Monitor uploads and processing

### Admin
- Client-specific admin access
- Complete control over assigned clients
- Manage chat groups for their clients
- View and manage conversations

### Manager
- Initiate chats and conversations
- Access to specific client data
- Create new analysis sessions

### User (Default)
- No client access by default
- Must be assigned by admin
- Contact admin message shown

## 🎨 Design System

### Colors
- **Primary**: #ffe600 (ting yellow)
- **Secondary**: #000000 (black)
- **Background**: Responsive light/dark themes

### Typography
- **Headings**: American Typewriter
- **Body**: System fonts
- **Brand**: "ting" always in small caps

### Components
- Fully responsive design
- Mobile-first approach
- Consistent spacing and typography
- Accessible color contrasts

## 🗄️ Database Schema

The system includes comprehensive tables for:

- **Users & Auth**: platform_users, user_client_access
- **Clients & Rooms**: clients, rooms (internal/external)
- **Data Processing**: uploads, jobs, chunks, embeddings
- **Analysis**: conversations, queries, feedback
- **Evaluation**: drivers, driver_behaviors, evaluation_policies, evaluations
- **Admin**: admin_settings

## 🔧 Configuration

### Platform Settings
Configurable via environment variables and admin settings:
- Platform name and branding
- Logo and favicon URLs
- Primary/secondary colors
- Signup enablement
- Email verification requirements

### Authentication Flow
1. User signs up (if enabled) or is created by admin
2. Default role: 'user' (no access)
3. Admin assigns client access with specific roles
4. Role-based dashboard and feature access

## 📱 Mobile Responsiveness

Every component is designed mobile-first:
- Responsive navigation and layouts
- Touch-friendly buttons and inputs
- Optimized typography scaling
- Mobile-specific spacing utilities

## 🚦 Getting Started Workflow

1. **Setup**: Follow installation steps above
2. **Admin Account**: Create super admin as described
3. **Client Setup**: Create your first client
4. **User Management**: Invite users and assign roles
5. **Data Upload**: Upload chat exports for analysis
6. **Analysis**: Start conversations and derive insights

## 🤝 Contributing

This is a private ting.in project. Contact the development team for contribution guidelines.

## 📄 License

Private - ting.in © 2024

---

**Ready to ting?** 🎉

Transform your chat data into actionable insights with TCIS!
