'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ClientPicker } from '@/components/ui/ClientPicker';
import { Button } from '@/components/ui/Button';
import { 
  ChatBubbleLeftRightIcon,
  PlusIcon,
  BuildingOfficeIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

export default function ChatPage() {
  const router = useRouter();
  const { platformUser } = useAuth();

  const handleClientSelect = (clientId: string) => {
    router.push(`/chat/${clientId}/conversations`);
  };

  return (
    <DashboardLayout 
      title="Chat Analysis"
      description="Select a client to start analyzing chat data with AI-powered insights"
      allowedRoles={['super_admin', 'backend', 'admin', 'manager']}
    >
      <div className="space-y-8">
        {/* Client Selection */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-[#ffe600]/10 to-[#ffe600]/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <ChatBubbleLeftRightIcon className="h-8 w-8 text-[#ffe600]" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Choose a Client
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Select a client to access their conversations and start analyzing chat data with AI insights.
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <ClientPicker
              onClientSelect={handleClientSelect}
              placeholder="Select a client to continue..."
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ActionCard
            title="Recent Conversations"
            description="Continue your latest analysis sessions"
            icon={<ChatBubbleLeftRightIcon className="h-6 w-6" />}
            onClick={() => {/* Handle recent conversations */}}
            color="blue"
          />
          <ActionCard
            title="Evaluation Mode"
            description="Analyze performance with driver-based scoring"
            icon={<BuildingOfficeIcon className="h-6 w-6" />}
            onClick={() => {/* Handle evaluation mode */}}
            color="green"
          />
          <ActionCard
            title="Browse Clients"
            description="View all your accessible clients"
            icon={<ArrowRightIcon className="h-6 w-6" />}
            onClick={() => router.push('/clients')}
            color="purple"
          />
        </div>

        {/* Getting Started */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start space-x-3">
            <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Getting Started with Chat Analysis
              </h4>
              <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                  <span>Select a client from the dropdown above to access their chat data</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                  <span>Create a new conversation or continue an existing one</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                  <span>Ask questions about chat patterns, sentiment, or specific topics</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                  <span>Enable evaluation mode for performance analysis with citations</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

interface ActionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  color: 'blue' | 'green' | 'purple';
}

function ActionCard({ title, description, icon, onClick, color }: ActionCardProps) {
  const colorClasses = {
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
    green: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20',
  };

  return (
    <button
      onClick={onClick}
      className="block w-full p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 text-left"
    >
      <div className={`inline-flex p-3 rounded-lg mb-4 ${colorClasses[color]}`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {description}
      </p>
    </button>
  );
}
