import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { friendlyError } from "@/lib/errors";

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

const ROLE_PRIORITY: SystemUser['role'][] = ['admin', 'fleet_manager', 'dispatcher', 'viewer'];

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

      // O usuario pode ter mais de um papel (ex.: viewer criado no cadastro + admin).
      const { data: currentUserRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUserId);

      const isAdmin = (currentUserRoles || []).some((r) => r.role === 'admin');

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

      // Com mais de um papel, vale o mais alto.
      const roleMap = new Map<string, SystemUser['role']>();
      for (const r of roles || []) {
        const current = roleMap.get(r.user_id);
        const role = r.role as SystemUser['role'];
        if (!current || ROLE_PRIORITY.indexOf(role) < ROLE_PRIORITY.indexOf(current)) {
          roleMap.set(r.user_id, role);
        }
      }

      // Motoristas (login do app) nao entram na lista de usuarios do painel.
      const { data: driverLogins } = await supabase
        .from('drivers')
        .select('user_id')
        .in('user_id', tenantUserIds);
      const driverUserIds = new Set((driverLogins || []).map(d => d.user_id));

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
          // Exclude driver logins from system user listing
          if (driverUserIds.has(profile.id)) return false;
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
      setError(friendlyError(err, 'Erro ao carregar usuários'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();

    // Nome unico por instancia: dois componentes com o mesmo canal se anulam.
    const suffix = Math.random().toString(36).slice(2);
    const profilesChannel = supabase
      .channel(`profiles-changes-${suffix}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => fetchUsers()
      )
      .subscribe();

    const rolesChannel = supabase
      .channel(`roles-changes-${suffix}`)
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

  const updateUserRole = async (userId: string, newRole: SystemUser['role']): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('set_user_role', {
        p_user_id: userId,
        p_role: newRole,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string } | null;
      if (!result?.success) {
        throw new Error(result?.error || 'Não foi possível alterar o nível de acesso.');
      }

      toast({
        title: 'Permissão atualizada',
        description: `Usuário agora é ${roleLabels[newRole]}.`,
      });

      await fetchUsers();
      return true;
    } catch (err: any) {
      console.error('Error updating role:', err);
      toast({
        title: 'Erro ao atualizar permissão',
        description: friendlyError(err),
        variant: 'destructive',
      });
      await fetchUsers();
      return false;
    }
  };

  const deleteUser = async (userId: string): Promise<boolean> => {
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
        title: 'Usuário deletado',
        description: 'Usuário removido completamente do sistema.',
      });

      // IMPORTANT: Remove from local state immediately
      setUsers(prevUsers => prevUsers.filter(u => u.user_id !== userId));
      return true;
    } catch (err: any) {
      console.error('Error deleting user:', err);
      toast({
        title: 'Erro ao deletar usuário',
        description: friendlyError(err),
        variant: 'destructive',
      });
      return false;
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
