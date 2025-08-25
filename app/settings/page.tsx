'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { 
  Cog6ToothIcon,
  UserIcon,
  UsersIcon,
  PaintBrushIcon,
  ShieldCheckIcon,
  BellIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';

export default function SettingsPage() {
  return (
    <DashboardLayout 
      title="Settings"
      description="Configure your platform preferences and system settings"
      allowedRoles={['super_admin', 'admin']}
    >
      <div className="space-y-6">
        {/* Settings Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            <SettingsCard
              title="Profile"
              description="Manage your account information"
              icon={<UserIcon className="h-6 w-6" />}
              href="/settings/profile"
            />
            <SettingsCard
              title="User Management"
              description="Manage platform users and roles"
              icon={<UsersIcon className="h-6 w-6" />}
              href="/settings/users"
            />
            <SettingsCard
              title="Appearance"
              description="Customize theme and display"
              icon={<PaintBrushIcon className="h-6 w-6" />}
              href="/settings/appearance"
            />
            <SettingsCard
              title="Security"
              description="Password and authentication"
              icon={<ShieldCheckIcon className="h-6 w-6" />}
              href="/settings/security"
            />
            <SettingsCard
              title="Notifications"
              description="Email and push preferences"
              icon={<BellIcon className="h-6 w-6" />}
              href="/settings/notifications"
            />
            <SettingsCard
              title="Platform"
              description="System-wide configurations"
              icon={<Cog6ToothIcon className="h-6 w-6" />}
              href="/settings/platform"
            />
            <SettingsCard
              title="Integrations"
              description="External service connections"
              icon={<GlobeAltIcon className="h-6 w-6" />}
              href="/settings/integrations"
            />
          </div>
        </div>

        {/* Quick Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Quick Settings
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Commonly used settings for quick access
            </p>
          </div>
          <div className="p-6 space-y-6">
            {/* Platform Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Platform Name
              </label>
              <Input
                defaultValue="TCIS"
                placeholder="Enter platform name"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This name appears in the sidebar and page titles
              </p>
            </div>

            {/* Primary Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Primary Color
              </label>
              <div className="flex items-center space-x-3">
                <Input
                  type="color"
                  defaultValue="#ffe600"
                  className="w-16 h-10 p-1 rounded"
                />
                <Input
                  defaultValue="#ffe600"
                  placeholder="#ffe600"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                The main brand color used throughout the platform
              </p>
            </div>

            {/* Enable Signups */}
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable User Signups
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Allow new users to register for accounts
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
              </label>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-3">
                <Button>
                  Save Changes
                </Button>
                <Button variant="outline">
                  Reset to Defaults
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

interface SettingsCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
}

function SettingsCard({ title, description, icon, href }: SettingsCardProps) {
  return (
    <a
      href={href}
      className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
    >
      <div className="flex items-start space-x-3">
        <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
          <div className="text-primary-600 dark:text-primary-400">
            {icon}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            {title}
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {description}
          </p>
        </div>
      </div>
    </a>
  );
}
