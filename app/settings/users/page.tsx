'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import { Modal } from '@/components/ui/Modal';
import toast from 'react-hot-toast';
import { 
  UserPlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface PlatformUser {
  id: string;
  email: string;
  full_name: string;
  platform_role: 'user' | 'manager' | 'admin' | 'backend' | 'super_admin';
  is_active: boolean;
  created_at: string;
  last_sign_in?: string;
}

interface ClientAccess {
  id: string;
  client_id: number;
  client_name: string;
  role: 'viewer' | 'editor' | 'admin';
  granted_by: string;
  granted_at: string;
}

export default function UserManagementPage() {
  const { supabase, platformUser } = useAuth();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [userAccess, setUserAccess] = useState<ClientAccess[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  // Form states
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    platform_role: 'user' as const,
    password: '',
    confirmPassword: ''
  });

  // Fetch users and clients
  useEffect(() => {
    const fetchData = async () => {
      if (!supabase) return;
      
      setLoading(true);
      try {
        // Fetch platform users
        const { data: usersData, error: usersError } = await supabase
          .from('platform_users')
          .select('*')
          .order('created_at', { ascending: false });

        if (usersError) throw usersError;

        // Fetch clients for access management
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('id, name')
          .eq('is_active', true);

        if (clientsError) throw clientsError;

        setUsers(usersData || []);
        setFilteredUsers(usersData || []);
        setClients(clientsData || []);

      } catch (error: any) {
        console.error('Error fetching users:', error);
        toast.error('Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  // Filter users based on search and filters
  useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.platform_role === roleFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => 
        statusFilter === 'active' ? user.is_active : !user.is_active
      );
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter, statusFilter]);

  // Fetch user access when modal opens
  const handleViewAccess = async (user: PlatformUser) => {
    if (!supabase) return;
    
    setSelectedUser(user);
    try {
      // Fetch user's client access
      const { data: accessData, error: accessError } = await supabase
        .from('user_client_access')
        .select(`
          id,
          client_id,
          role,
          granted_at,
          clients!inner(name)
        `)
        .eq('user_id', user.id);

      if (accessError) throw accessError;

      const formattedAccess = (accessData || []).map(access => ({
        id: access.id,
        client_id: access.client_id,
        client_name: access.clients.name,
        role: access.role,
        granted_by: 'System', // You might want to fetch this from a separate table
        granted_at: access.granted_at
      }));

      setUserAccess(formattedAccess);
      setShowAccessModal(true);

    } catch (error: any) {
      console.error('Error fetching user access:', error);
      toast.error('Failed to load user access');
    }
  };

  // Handle user creation
  const handleCreateUser = async () => {
    if (!supabase) return;
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        user_metadata: {
          full_name: formData.full_name,
          platform_role: formData.platform_role
        }
      });

      if (authError) throw authError;

      // Create platform user record
      const { error: platformError } = await supabase
        .from('platform_users')
        .insert({
          id: authData.user.id,
          email: formData.email,
          full_name: formData.full_name,
          platform_role: formData.platform_role,
          is_active: true
        });

      if (platformError) throw platformError;

      toast.success('User created successfully');
      setShowCreateModal(false);
      setFormData({
        email: '',
        full_name: '',
        platform_role: 'user',
        password: '',
        confirmPassword: ''
      });

      // Refresh users list
      const { data: usersData } = await supabase
        .from('platform_users')
        .select('*')
        .order('created_at', { ascending: false });
      
      setUsers(usersData || []);
      setFilteredUsers(usersData || []);

    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error('Failed to create user');
    }
  };

  // Handle user editing
  const handleEditUser = async () => {
    if (!supabase || !selectedUser) return;

    try {
      const { error } = await supabase
        .from('platform_users')
        .update({
          full_name: formData.full_name,
          platform_role: formData.platform_role,
          is_active: selectedUser.is_active
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast.success('User updated successfully');
      setShowEditModal(false);
      setSelectedUser(null);

      // Refresh users list
      const { data: usersData } = await supabase
        .from('platform_users')
        .select('*')
        .order('created_at', { ascending: false });
      
      setUsers(usersData || []);
      setFilteredUsers(usersData || []);

    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  // Handle user deletion
  const handleDeleteUser = async (user: PlatformUser) => {
    if (!supabase || !confirm(`Are you sure you want to delete ${user.full_name}?`)) return;

    try {
      // Deactivate user instead of deleting
      const { error } = await supabase
        .from('platform_users')
        .update({ is_active: false })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('User deactivated successfully');

      // Refresh users list
      const { data: usersData } = await supabase
        .from('platform_users')
        .select('*')
        .order('created_at', { ascending: false });
      
      setUsers(usersData || []);
      setFilteredUsers(usersData || []);

    } catch (error: any) {
      console.error('Error deactivating user:', error);
      toast.error('Failed to deactivate user');
    }
  };

  // Handle user access management
  const handleGrantAccess = async (clientId: number, role: string) => {
    if (!supabase || !selectedUser) return;

    try {
      const { error } = await supabase
        .from('user_client_access')
        .insert({
          user_id: selectedUser.id,
          client_id: clientId,
          role: role,
          granted_by: platformUser?.id
        });

      if (error) throw error;

      toast.success('Access granted successfully');
      
      // Refresh user access
      const { data: accessData } = await supabase
        .from('user_client_access')
        .select(`
          id,
          client_id,
          role,
          granted_at,
          clients!inner(name)
        `)
        .eq('user_id', selectedUser.id);

      const formattedAccess = (accessData || []).map(access => ({
        id: access.id,
        client_id: access.client_id,
        client_name: access.clients.name,
        role: access.role,
        granted_by: 'System',
        granted_at: access.granted_at
      }));

      setUserAccess(formattedAccess);

    } catch (error: any) {
      console.error('Error granting access:', error);
      toast.error('Failed to grant access');
    }
  };

  // Handle user access removal
  const handleRemoveAccess = async (accessId: string) => {
    if (!supabase || !confirm('Are you sure you want to remove this access?')) return;

    try {
      const { error } = await supabase
        .from('user_client_access')
        .delete()
        .eq('id', accessId);

      if (error) throw error;

      toast.success('Access removed successfully');
      
      // Refresh user access
      setUserAccess(prev => prev.filter(access => access.id !== accessId));

    } catch (error: any) {
      console.error('Error removing access:', error);
      toast.error('Failed to remove access');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'admin': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'backend': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'manager': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getStatusBadge = (isActive: boolean) => (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      isActive 
        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    )}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );

  if (loading) {
    return (
      <DashboardLayout 
        title="User Management"
        description="Manage platform users, roles, and client access"
        allowedRoles={['super_admin', 'admin']}
      >
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ffe600]"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="User Management"
      description="Manage platform users, roles, and client access"
      allowedRoles={['super_admin', 'admin']}
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Platform Users
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {filteredUsers.length} of {users.length} users
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <UserPlusIcon className="h-5 w-5 mr-2" />
            Add User
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="all">All Roles</option>
              <option value="user">User</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
              <option value="backend">Backend</option>
              <option value="super_admin">Super Admin</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Clear Filters */}
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setRoleFilter('all');
                setStatusFilter('all');
              }}
              className="flex items-center justify-center"
            >
              <XMarkIcon className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Sign In
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#ffe600]/10 to-[#ffe600]/5 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-[#ffe600]">
                            {user.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.full_name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        getRoleBadgeColor(user.platform_role)
                      )}>
                        {user.platform_role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(user.is_active)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.last_sign_in 
                        ? new Date(user.last_sign_in).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setFormData({
                              email: user.email,
                              full_name: user.full_name,
                              platform_role: user.platform_role,
                              password: '',
                              confirmPassword: ''
                            });
                            setShowEditModal(true);
                          }}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewAccess(user)}
                        >
                          <EyeIcon className="h-4 w-4" />
                        </Button>
                        {user.platform_role !== 'super_admin' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteUser(user)}
                            className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New User"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Full Name
            </label>
            <Input
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              placeholder="Enter full name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Enter email address"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Platform Role
            </label>
            <select
              value={formData.platform_role}
              onChange={(e) => setFormData(prev => ({ ...prev, platform_role: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="user">User</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
              <option value="backend">Backend</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Enter password"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Confirm Password
            </label>
            <Input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              placeholder="Confirm password"
            />
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-6">
          <Button variant="outline" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateUser}>
            Create User
          </Button>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit User"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Full Name
            </label>
            <Input
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              placeholder="Enter full name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Platform Role
            </label>
            <select
              value={formData.platform_role}
              onChange={(e) => setFormData(prev => ({ ...prev, platform_role: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="user">User</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
              <option value="backend">Backend</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="isActive"
              checked={selectedUser?.is_active || false}
              onChange={(e) => setSelectedUser(prev => prev ? { ...prev, is_active: e.target.checked } : null)}
              className="rounded border-gray-300 text-[#ffe600] focus:ring-[#ffe600]"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              User is active
            </label>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-6">
          <Button variant="outline" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleEditUser}>
            Update User
          </Button>
        </div>
      </Modal>

      {/* User Access Modal */}
      <Modal
        isOpen={showAccessModal}
        onClose={() => setShowAccessModal(false)}
        title={`Client Access - ${selectedUser?.full_name}`}
        size="xl"
      >
        <div className="space-y-6">
          {/* Current Access */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Current Client Access
            </h3>
            {userAccess.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                No client access granted
              </p>
            ) : (
              <div className="space-y-3">
                {userAccess.map((access) => (
                  <div key={access.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {access.client_name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Role: {access.role} • Granted: {new Date(access.granted_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveAccess(access.id)}
                      className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Grant New Access */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Grant New Access
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                id="clientSelect"
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">Select Client</option>
                {clients
                  .filter(client => !userAccess.some(access => access.client_id === client.id))
                  .map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))
                }
              </select>
              
              <select
                id="roleSelect"
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
              
              <Button
                onClick={() => {
                  const clientId = (document.getElementById('clientSelect') as HTMLSelectElement).value;
                  const role = (document.getElementById('roleSelect') as HTMLSelectElement).value;
                  if (clientId && role) {
                    handleGrantAccess(parseInt(clientId), role);
                    (document.getElementById('clientSelect') as HTMLSelectElement).value = '';
                    (document.getElementById('roleSelect') as HTMLSelectElement).value = 'viewer';
                  }
                }}
                disabled={!clients.some(client => !userAccess.some(access => access.client_id === client.id))}
              >
                Grant Access
              </Button>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end mt-6">
          <Button variant="outline" onClick={() => setShowAccessModal(false)}>
            Close
          </Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
