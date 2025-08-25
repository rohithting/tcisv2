'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ChatBubbleLeftRightIcon, 
  ChartBarIcon, 
  DocumentArrowUpIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-200"></div>
      </div>
    );
  }

  // Don't show landing page if user is authenticated
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="relative z-10">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            {/* Logo */}
            <div className="flex items-center">
              <div className="w-10 h-10 bg-primary-200 rounded-full flex items-center justify-center mr-3">
                <span className="text-xl font-bold text-black ting-text">t</span>
              </div>
              <h1 className="text-2xl brand-heading text-gray-900 dark:text-white">
                <span className="ting-text">ting</span> TCIS
              </h1>
            </div>

            {/* Navigation */}
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <Link href="/auth/login">
                <Button variant="outline" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/auth/signup">
                <Button size="sm">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl brand-heading text-gray-900 dark:text-white mb-6">
              Welcome to{' '}
              <span className="text-primary-600 ting-text">ting</span>{' '}
              <br className="hidden sm:block" />
              Chat Insight System
            </h1>
            
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              Derive actionable insights from your WhatsApp and Zoho Cliq chat exports. 
              Transform conversations into strategic intelligence with AI-powered analysis.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link href="/auth/signup">
                <Button size="lg" className="min-w-[200px]">
                  Start Analyzing
                  <ArrowRightIcon className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="outline" size="lg" className="min-w-[200px]">
                  Sign In
                </Button>
              </Link>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-16">
              <FeatureCard
                icon={<DocumentArrowUpIcon className="h-8 w-8" />}
                title="Easy Upload"
                description="Upload WhatsApp and Zoho Cliq exports in TXT, CSV, or JSON format"
                color="blue"
              />
              <FeatureCard
                icon={<SparklesIcon className="h-8 w-8" />}
                title="AI Processing"
                description="Advanced AI parsing and chunking with vector embeddings"
                color="purple"
              />
              <FeatureCard
                icon={<ChatBubbleLeftRightIcon className="h-8 w-8" />}
                title="Smart Queries"
                description="Ask questions and get insights using RAG technology"
                color="green"
              />
              <FeatureCard
                icon={<ChartBarIcon className="h-8 w-8" />}
                title="Actionable Insights"
                description="Generate reports with evaluation drivers and behavioral analysis"
                color="yellow"
              />
            </div>
          </div>
        </div>

        {/* Security & Trust Section */}
        <div className="bg-gray-100 dark:bg-gray-800 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <ShieldCheckIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            
            <h2 className="text-3xl brand-heading text-gray-900 dark:text-white mb-4">
              Enterprise-Grade Security
            </h2>
            
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Your chat data is protected with row-level security, role-based access control, 
              and complete audit trails. Only authorized team members can access relevant insights.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600 mb-2">256-bit</div>
                <div className="text-gray-600 dark:text-gray-400">Encryption</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600 mb-2">RBAC</div>
                <div className="text-gray-600 dark:text-gray-400">Access Control</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600 mb-2">100%</div>
                <div className="text-gray-600 dark:text-gray-400">Audit Trail</div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="py-16">
          <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl brand-heading text-gray-900 dark:text-white mb-4">
              Ready to <span className="ting-text text-primary-600">ting</span>?
            </h2>
            
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
              Join teams already using TCIS to transform their chat data into strategic insights.
            </p>

            <Link href="/auth/signup">
              <Button size="lg" className="text-lg px-8 py-4">
                Get Started Today
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-black text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-8 h-8 bg-primary-200 rounded-full flex items-center justify-center mr-3">
              <span className="text-lg font-bold text-black ting-text">t</span>
            </div>
            <span className="text-lg brand-heading">
              <span className="ting-text">ting</span> TCIS
            </span>
          </div>
          
          <p className="text-gray-400 text-sm">
            © 2024 <span className="ting-text">ting</span>.in - Chat Insight System. 
            Transforming conversations into intelligence.
          </p>
        </div>
      </footer>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'blue' | 'green' | 'purple' | 'yellow';
}

function FeatureCard({ icon, title, description, color }: FeatureCardProps) {
  const colorClasses = {
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
    green: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20',
    yellow: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
  };

  return (
    <div className="text-center">
      <div className={`inline-flex p-4 rounded-xl ${colorClasses[color]} mb-4`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm">
        {description}
      </p>
    </div>
  );
}
