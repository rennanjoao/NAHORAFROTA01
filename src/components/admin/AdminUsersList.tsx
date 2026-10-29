import type { ReactNode } from "react";
import { Pencil, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, ListSkeleton } from "@/components/patterns";
import type { SystemUser } from "@/hooks/useSystemUsers";
import { PersonAvatar } from "./PersonAvatar";
import { ADMIN_ROLE_LABELS } from "./roleOptions";

// "viewer" e o login do app do motorista: nao se atribui pelo painel.
const ASSIGNABLE_ROLES = Object.entries(ADMIN_ROLE_LABELS).filter(([value]) => value !== "viewer");

const formatDate = (value: string) => new Date(value).toLocaleDateString("pt-BR");

interface AdminUsersListProps {
  users: SystemUser[];
  isLoading: boolean;
  currentUserId?: string;
  emptyAction?: ReactNode;
  onRoleChange: (userId: string, role: SystemUser["role"]) => void;
  onEdit: (user: SystemUser) => void;
  onRemove: (user: SystemUser) => void;
}

function RoleSelect({
  user,
  disabled,
  lockReason,
  hintId,
  onRoleChange,
  className,
}: {
  user: SystemUser;
  disabled: boolean;
  /** Por que nao da para mudar (vira dica do campo e tooltip no computador). */
  lockReason?: string | null;
  hintId?: string;
  onRoleChange: AdminUsersListProps["onRoleChange"];
  className?: string;
}) {
  return (
    <Select
      value={user.role}
      onValueChange={(value) => onRoleChange(user.user_id, value as SystemUser["role"])}
      disabled={disabled}
    >
      <SelectTrigger
        className={className}
        aria-label={`Nível de acesso de ${user.name}`}
        aria-describedby={hintId}
        title={lockReason ?? undefined}
      >
        <SelectValue>{ADMIN_ROLE_LABELS[user.role] ?? user.role}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {ASSIGNABLE_ROLES.map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function IconAction({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          aria-label={label}
          className={danger ? "text-destructive hover:bg-destructive/10 hover:text-destructive" : "text-muted-foreground hover:text-foreground"}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Usuarios do painel: tabela no computador, cartoes no celular. */
export function AdminUsersList({
  users,
  isLoading,
  currentUserId,
  emptyAction,
  onRoleChange,
  onEdit,
  onRemove,
}: AdminUsersListProps) {
  // Esqueleto so na primeira carga: ao atualizar, a lista fica (e o foco nao se perde).
  if (isLoading && users.length === 0) return <ListSkeleton rows={3} />;

  // A empresa nao pode ficar sem administrador (o servidor tambem recusa).
  const adminCount = users.filter((u) => u.role === "admin").length;
  const lockReason = (systemUser: SystemUser) =>
    systemUser.user_id === currentUserId
      ? "Você não pode mudar o seu próprio nível."
      : systemUser.role === "admin" && adminCount <= 1
        ? "A empresa precisa de pelo menos um administrador."
        : null;

  if (users.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhum usuário ainda"
        description="Crie um usuário ou gere um acesso para cada pessoa da equipe entrar no painel."
        action={emptyAction}
      />
    );
  }

  return (
    <>
      {/* Computador */}
      <Card className="hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead className="w-[13rem]">Nível de acesso</TableHead>
              <TableHead className="w-[8rem]">Desde</TableHead>
              <TableHead className="w-[7rem] text-right">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((systemUser) => {
              const isCurrentUser = systemUser.user_id === currentUserId;
              const locked = lockReason(systemUser);
              return (
                <TableRow key={systemUser.id}>
                  {/* Largura maxima: nome ou e-mail longo nao empurra as outras colunas. */}
                  <TableCell className="max-w-[20rem]">
                    <div className="flex min-w-0 items-center gap-3">
                      <PersonAvatar name={systemUser.name} src={systemUser.avatar_url} />
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-medium text-foreground">
                          <span className="truncate" title={systemUser.name}>{systemUser.name}</span>
                          {isCurrentUser && <Badge variant="outline">Você</Badge>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground" title={systemUser.email}>
                          {systemUser.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <RoleSelect
                      user={systemUser}
                      disabled={!!locked}
                      lockReason={locked}
                      hintId={locked ? `nivel-${systemUser.user_id}` : undefined}
                      onRoleChange={onRoleChange}
                    />
                    {locked && (
                      <p id={`nivel-${systemUser.user_id}`} className="mt-1 text-xs text-muted-foreground">
                        {locked}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(systemUser.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <IconAction label={`Editar ${systemUser.name}`} onClick={() => onEdit(systemUser)}>
                        <Pencil aria-hidden="true" />
                      </IconAction>
                      {isCurrentUser ? (
                        // Mesmo lugar do botao de remover: os lapis ficam alinhados na coluna.
                        <span className="h-10 w-10 shrink-0" aria-hidden="true" />
                      ) : (
                        <IconAction label={`Remover ${systemUser.name}`} onClick={() => onRemove(systemUser)} danger>
                          <Trash2 aria-hidden="true" />
                        </IconAction>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Celular */}
      <ul className="stagger space-y-3 md:hidden">
        {users.map((systemUser) => {
          const isCurrentUser = systemUser.user_id === currentUserId;
          const locked = lockReason(systemUser);
          return (
            <li key={systemUser.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex min-w-0 items-center gap-3">
                <PersonAvatar name={systemUser.name} src={systemUser.avatar_url} className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    <span className="truncate" title={systemUser.name}>{systemUser.name}</span>
                    {isCurrentUser && <Badge variant="outline">Você</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" title={systemUser.email}>
                    {systemUser.email}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <RoleSelect user={systemUser} disabled={!!locked} lockReason={locked} hintId={`nivel-cel-${systemUser.user_id}`} onRoleChange={onRoleChange} />
                <p id={`nivel-cel-${systemUser.user_id}`} className="text-xs text-muted-foreground">
                  {locked ?? `No painel desde ${formatDate(systemUser.created_at)}`}
                </p>
              </div>
              <div className="mt-3 flex gap-2 border-t pt-3">
                <Button variant="outline" className="flex-1" onClick={() => onEdit(systemUser)}>
                  <Pencil aria-hidden="true" />
                  Editar<span className="sr-only"> {systemUser.name}</span>
                </Button>
                {!isCurrentUser && (
                  <Button
                    variant="ghost"
                    className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onRemove(systemUser)}
                  >
                    <Trash2 aria-hidden="true" />
                    Remover<span className="sr-only"> {systemUser.name}</span>
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
