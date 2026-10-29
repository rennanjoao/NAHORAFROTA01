import { Link } from "react-router-dom";
import { ArrowRight, Check, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ListSkeleton } from "@/components/patterns";
import { PersonAvatar } from "@/components/admin/PersonAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { useSystemUsers, type SystemUser } from "@/hooks/useSystemUsers";
import { PANEL_ROLES, ROLE_HIERARCHY, ROLE_PERMISSIONS, getHighestRole, getRoleLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { SettingsCard } from "./SettingsCard";

/** Lista de usuarios da empresa com troca de nivel de acesso (somente admin). */
function TenantUsersRoles() {
  const { user } = useAuth();
  const { users, isLoading, updateUserRole } = useSystemUsers();
  const adminCount = users.filter((u) => u.role === "admin").length;

  if (isLoading) {
    return <ListSkeleton rows={3} className="rounded-none border-x-0 border-b-0" />;
  }

  if (users.length === 0) {
    return (
      <EmptyState
        compact
        icon={Users}
        title="Nenhum usuário cadastrado"
        description="Convide a equipe pela Administração para cada pessoa ter o próprio acesso."
      />
    );
  }

  return (
    <ul className="divide-y border-t">
      {users.map((member) => {
        const isSelf = member.user_id === user?.id;
        // Evita que a conta fique sem administrador.
        const isLastAdmin = member.role === "admin" && adminCount <= 1;
        const locked = isSelf || isLastAdmin;
        const lockedReason = isSelf
          ? "Você não pode mudar o seu próprio nível."
          : "A empresa precisa de pelo menos um administrador.";
        const hintId = `nivel-${member.user_id}-dica`;
        return (
          <li
            key={member.user_id}
            className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
          >
            <div className="flex min-w-0 items-center gap-3">
              <PersonAvatar name={member.name} src={member.avatar_url} />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-foreground">
                  <span className="truncate">{member.name}</span>
                  {isSelf && <Badge variant="outline">Você</Badge>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{member.email}</p>
              </div>
            </div>
            <div className="w-full space-y-1 sm:w-56">
              <Select
                value={member.role}
                disabled={locked}
                onValueChange={(value) => updateUserRole(member.user_id, value as SystemUser["role"])}
              >
                <SelectTrigger
                  aria-label={`Nível de acesso de ${member.name}`}
                  aria-describedby={locked ? hintId : undefined}
                >
                  <SelectValue>{getRoleLabel(member.role)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PANEL_ROLES.map((role) => (
                    <SelectItem key={role.role} value={role.role}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {locked && (
                <p id={hintId} className="text-xs text-muted-foreground">
                  {lockedReason}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function UserHierarchyTab() {
  const { roles, isAdmin } = useAuth();
  const myRole = getHighestRole(roles);
  const admin = isAdmin();

  return (
    <div className="space-y-6">
      <SettingsCard
        icon={ShieldCheck}
        title="Níveis de acesso"
        description="Cada pessoa da equipe tem um nível. O nível define o que ela pode fazer no sistema."
        actions={
          myRole && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              Seu nível
              <Badge variant="default">{getRoleLabel(myRole)}</Badge>
            </p>
          )
        }
      >
        <ol className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ROLE_HIERARCHY.map((role, index) => {
            const mine = role.role === myRole;
            return (
              <li
                key={role.role}
                className={cn(
                  "flex gap-3 rounded-lg border p-4",
                  mine ? "border-primary/40 bg-primary/5" : "bg-card",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-data text-xs font-semibold",
                    mine ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {role.label}
                    {mine && <span className="sr-only"> (seu nível)</span>}
                  </p>
                  <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted-foreground">{role.description}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 border-t pt-6">
          <h3 className="text-sm font-semibold text-foreground">Quem pode fazer o quê</h3>
          <ul className="mt-3 divide-y rounded-lg border">
            {ROLE_PERMISSIONS.map((permission) => (
              <li
                key={permission.label}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                <span className="text-sm text-foreground">{permission.label}</span>
                <span className="flex flex-wrap gap-1.5 sm:justify-end">
                  <span className="sr-only">Permitido para: </span>
                  {ROLE_HIERARCHY.filter((role) => permission.roles.includes(role.role)).map((role) => (
                    <Badge key={role.role} variant={role.role === myRole ? "default" : "secondary"}>
                      <Check aria-hidden="true" />
                      {role.label}
                    </Badge>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={Users}
        title="Usuários da empresa"
        description={
          admin
            ? "Defina o nível de cada pessoa. Para convidar ou remover alguém, use a Administração."
            : "Somente o administrador pode mudar os níveis de acesso. Fale com ele se precisar de outra permissão."
        }
        contentClassName="px-0 pb-0 sm:px-0 sm:pb-0"
        actions={
          admin && (
            <Button asChild variant="outline">
              <Link to="/admin">
                Abrir administração
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          )
        }
      >
        {admin ? <TenantUsersRoles /> : null}
      </SettingsCard>
    </div>
  );
}
