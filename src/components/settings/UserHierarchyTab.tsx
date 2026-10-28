import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, ExternalLink, Loader2, Minus, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSystemUsers, type SystemUser } from "@/hooks/useSystemUsers";
import { ROLE_HIERARCHY, ROLE_PERMISSIONS, getHighestRole, getRoleLabel } from "@/lib/roles";

/** Lista de usuarios da empresa com troca de nivel de acesso (somente admin). */
function TenantUsersRoles() {
  const { user } = useAuth();
  const { users, isLoading, updateUserRole } = useSystemUsers();
  const adminCount = users.filter((u) => u.role === "admin").length;

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">Nenhum usuário cadastrado.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Usuário</TableHead>
          <TableHead className="w-[220px]">Nível de acesso</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((member) => {
          const isSelf = member.user_id === user?.id;
          // Evita que a conta fique sem administrador.
          const isLastAdmin = member.role === "admin" && adminCount <= 1;
          const locked = isSelf || isLastAdmin;
          return (
            <TableRow key={member.user_id}>
              <TableCell>
                <p className="font-medium text-sm">
                  {member.name}
                  {isSelf && <span className="text-muted-foreground font-normal"> (você)</span>}
                </p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
              </TableCell>
              <TableCell>
                <Select
                  value={member.role}
                  disabled={locked}
                  onValueChange={(value) => updateUserRole(member.user_id, value as SystemUser["role"])}
                >
                  <SelectTrigger className="h-9" title={locked ? "Não é possível alterar o próprio acesso nem o último administrador" : undefined}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_HIERARCHY.map((role) => (
                      <SelectItem key={role.role} value={role.role}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function UserHierarchyTab() {
  const navigate = useNavigate();
  const { roles, isAdmin } = useAuth();
  const myRole = getHighestRole(roles);
  const admin = isAdmin();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Hierarquia de Acesso
          </CardTitle>
          <CardDescription>
            O que cada nível pode fazer no sistema.
            {myRole && (
              <>
                {" "}Seu nível: <Badge variant="secondary">{getRoleLabel(myRole)}</Badge>
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {ROLE_HIERARCHY.map((role, index) => (
              <div key={role.role} className="rounded-lg border p-3">
                <p className="text-sm font-medium">
                  {index + 1}. {role.label}
                </p>
                <p className="text-xs text-muted-foreground">{role.description}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Permissão</TableHead>
                  {ROLE_HIERARCHY.map((role) => (
                    <TableHead key={role.role} className="text-center whitespace-nowrap">
                      {role.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROLE_PERMISSIONS.map((permission) => (
                  <TableRow key={permission.label}>
                    <TableCell className="text-sm">{permission.label}</TableCell>
                    {ROLE_HIERARCHY.map((role) => {
                      const allowed = permission.roles.includes(role.role);
                      return (
                        <TableCell key={role.role} className="text-center">
                          {allowed ? (
                            <Check className="h-4 w-4 text-success inline" aria-label="Permitido" />
                          ) : (
                            <Minus className="h-4 w-4 text-muted-foreground/50 inline" aria-label="Não permitido" />
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários da Empresa
            </CardTitle>
            <CardDescription>
              {admin
                ? "Defina o nível de acesso de cada usuário. Para convidar ou remover usuários, use a Área Administrativa."
                : "Somente o Administrador pode alterar os níveis de acesso. Fale com ele se precisar de outra permissão."}
            </CardDescription>
          </div>
          {admin && (
            <Button variant="outline" size="sm" onClick={() => navigate("/admin")} className="gap-2 shrink-0">
              <ExternalLink className="h-4 w-4" />
              Área Administrativa
            </Button>
          )}
        </CardHeader>
        {admin && (
          <CardContent className="p-0">
            <TenantUsersRoles />
          </CardContent>
        )}
      </Card>
    </div>
  );
}
