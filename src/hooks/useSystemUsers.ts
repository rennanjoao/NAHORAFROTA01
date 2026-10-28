import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface SystemUser {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'admin' | 'fleet_manager' | 'dispatcher' | 'viewer';
  avatar_url: string | null;
  created_at: string;
  is_active: boolean;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  fleet_manager: 'Gestor de Frota',
  dispatcher: 'Despachante',
  viewer: 'Visualizador',
};

export function useSystemUsers() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const currentUserId = (await supabase.auth.getUser()).data.user?.id ?? '';

      // First check if current user is admin
      const { data: currentUserRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUserId)
        .single();

      const isAdmin = currentUserRole?.role === 'admin';

      if (!isAdmin) {
        setUsers([]);
        setError('Acesso restrito a administradores');
        return;
      }

      // Get current user's tenant_id for data isolation
      const { data: membership } = await supabase
        .from('tenant_memberships')
        .select('tenant_id')
        .eq('user_id', currentUserId)
        .maybeSingle();

      const tenantId = membership?.tenant_id;

      if (!tenantId) {
        setUsers([]);
        return;
      }

      // Get only users that belong to this tenant
      const { data: tenantMembers, error: membersError } = await supabase
        .from('tenant_memberships')
        .select('user_id')
        .eq('tenant_id', tenantId);

      if (membersError) throw membersError;

      const tenantUserIds = (tenantMembers || []).map(m => m.user_id);

      if (tenantUserIds.length === 0) {
        setUsers([]);
        return;
      }

      // Fetch profiles only for tenant members
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url, created_at')
        .in('id', tenantUserIds);

      if (profileError) throw profileError;

      // Fetch roles only for tenant members
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', tenantUserIds);

      if (rolesError) throw rolesError;

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      // Fetch platform admin IDs to exclude them from tenant user lists
      const { data: platformAdmins } = await supabase
        .from('platform_admins')
        .select('user_id');

      const platformAdminIds = new Set((platformAdmins || []).map(pa => pa.user_id));

      // Filter out platform admins and driver emails from client tenant views
      const combinedUsers: SystemUser[] = (profiles || [])
        .filter(profile => {
          // Exclude platform admins (Master users) from tenant lists
          if (platformAdminIds.has(profile.id)) return false;
          // Exclude driver emails from system user listing
          const email = profile.email?.toLowerCase() || '';
          if (email.endsWith('@driver.nahorafrota.app')) return false;
          return true;
        })
        .map(profile => ({
          id: profile.id,
          user_id: profile.id,
          name: profile.name || 'Sem nome',
          email: profile.email || '',
          role: (roleMap.get(profile.id) as SystemUser['role']) || 'viewer',
          avatar_url: profile.avatar_url,
          created_at: profile.created_at || new Date().toISOString(),
          is_active: true,
        }));

      setUsers(combinedUsers);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Erro ao carregar usuários');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();

    // Subscribe to changes in profiles and user_roles
    const profilesChannel = supabase
      .channel('profiles-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => fetchUsers()
      )
      .subscribe();

    const rolesChannel = supabase
      .channel('roles-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles' },
        () => fetchUsers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(rolesChannel);
    };
  }, [fetchUsers]);

  const updateUserRole = async (userId: string, newRole: SystemUser['role']) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: '✅ Permissão atualizada',
        description: `Usuário agora é ${roleLabels[newRole]}.`,
      });

      // Refetch to ensure UI is updated
      fetchUsers();
    } catch (err: any) {
      console.error('Error updating role:', err);
      toast({
        title: 'Erro ao atualizar permissão',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      // Call RPC function to delete everything
      const { data, error } = await supabase.rpc('delete_user_complete', {
        p_user_id: userId
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string } | null;
      if (result && !result.success) {
        throw new Error(result.error || 'Erro ao deletar usuário');
      }

      toast({
        title: '🗑️ Usuário deletado',
        description: 'Usuário removido completamente do sistema.',
      });

      // IMPORTANT: Remove from local state immediately
      setUsers(prevUsers => prevUsers.filter(u => u.user_id !== userId));
    } catch (err: any) {
      console.error('Error deleting user:', err);
      toast({
        title: 'Erro ao deletar usuário',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  return {
    users,
    isLoading,
    error,
    refetch: fetchUsers,
    updateUserRole,
    deleteUser,
    roleLabels,
  };
}
