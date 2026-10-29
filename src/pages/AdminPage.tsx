import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  CreditCard,
  Users,
  Crown,
  Check,
  Mail,
  Trash2,
  Loader2,
  RefreshCw,
  UserPlus,
  Truck,
  Pencil,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CreateDriverModal } from "@/components/admin/CreateDriverModal";
import { InviteUserDialog } from "@/components/admin/InviteUserDialog";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { useSystemUsers, SystemUser } from "@/hooks/useSystemUsers";
import { useDriversDB } from "@/hooks/useDriversDB";
import { EditAccessDialog } from "@/components/admin/EditAccessDialog";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { PlanLimitBanner } from "@/components/plan/PlanLimitBanner";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";


const roleConfig: Record<string, { label: string; className: string }> = {
  admin: { label: "Administrador", className: "bg-destructive text-destructive-foreground" },
  fleet_manager: { label: "Gestor de Frota", className: "bg-primary text-primary-foreground" },
  dispatcher: { label: "Despachante", className: "bg-info text-info-foreground" },
  viewer: { label: "Visualizador", className: "bg-muted text-muted-foreground" },
};

export default function AdminPage() {
  const { user } = useAuth();
  const { users, isLoading, error, refetch, updateUserRole, deleteUser, roleLabels } = useSystemUsers();
  const {
    drivers,
    isLoading: isLoadingDrivers,
    error: driversError,
    fetchDrivers,
  } = useDriversDB();
  const {
    canAddUser,
    canAddDriver,
    systemUsersCount,
    driversCount,
    vehiclesCount,
    limits,
    plan,
    contractedPlan,
    planLabels: pLabels,
    isLoading: planLimitsLoading,
  } = usePlanLimits();
  const { status: subscriptionStatus, daysRemaining, access } = useSubscriptionStatus();
  const isTrial = subscriptionStatus === "trial";
  const planBadge = isTrial
    ? { label: "Teste grátis", className: "bg-primary text-primary-foreground" }
    : subscriptionStatus === "expired"
      ? { label: "Vencido", className: "bg-destructive text-destructive-foreground" }
      : subscriptionStatus === "overdue"
        ? { label: "Em atraso", className: "bg-destructive text-destructive-foreground" }
      : subscriptionStatus === "due_today" || subscriptionStatus === "warning"
        ? { label: "Vencendo", className: "bg-warning text-warning-foreground" }
        : { label: "Ativo", className: "bg-success text-success-foreground" };
  const formatDate = (value?: string | null) =>
    value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString("pt-BR") : null;
  const billingLine = isTrial
    ? `Teste grátis até ${formatDate(access?.trial_ends_at) ?? "—"} (${daysRemaining <= 0 ? "termina hoje" : `${daysRemaining} dia(s) restante(s)`})`
    : formatDate(access?.next_due_date)
      ? `Próxima cobrança: ${formatDate(access?.next_due_date)}`
      : "Próxima cobrança: a definir com a equipe Na Hora Frota";
  const [editTarget, setEditTarget] = useState<
    | { type: "user"; record: SystemUser }
    | { type: "driver"; record: (typeof drivers)[number] }
    | null
  >(null);

  const refreshAdminLists = async () => {
    await Promise.all([refetch(), fetchDrivers()]);
  };

  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const handleDeleteUser = async (userId: string, userName: string) => {
    // Prevent deleting yourself
    if (userId === user?.id) {
      toast({
        title: "Ação não permitida",
        description: "Você não pode remover seu próprio usuário.",
        variant: "destructive",
      });
      return;
    }

    // Check if it's the last admin
    const admins = users.filter(u => u.role === 'admin');
    const targetUser = users.find(u => u.user_id === userId);
    if (targetUser?.role === 'admin' && admins.length <= 1) {
      toast({
        title: "Ação não permitida",
        description: "Não é possível remover o último administrador.",
        variant: "destructive",
      });
      return;
    }

    await deleteUser(userId);
    setUserToDelete(null);
  };

  const handleRoleChange = async (userId: string, newRole: SystemUser['role']) => {
    await updateUserRole(userId, newRole);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            Área Administrativa
          </h1>
          <p className="text-muted-foreground">Gerenciamento de planos, pagamentos e usuários</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="plans" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Planos e Pagamentos
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Gestão de Usuários
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Plano e cobranca (dados reais da empresa; antes havia boleto,
              QR Code PIX e formulario de cartao de mentira) */}
          <TabsContent value="plans" className="space-y-6">
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary">
                      <Crown className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <CardTitle>
                        {isTrial ? "Teste grátis — acesso completo" : `Plano ${pLabels[contractedPlan] || contractedPlan}`}
                      </CardTitle>
                      <CardDescription>{access?.razao_social || "Sua empresa"}</CardDescription>
                    </div>
                  </div>
                  <Badge className={planBadge.className}>{planBadge.label}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">{billingLine}</p>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="text-muted-foreground">Usuários do painel: </span>
                        <span className="font-medium">
                          {systemUsersCount} / {limits.max_users === -1 ? "ilimitado" : limits.max_users}
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Motoristas: </span>
                        <span className="font-medium">
                          {driversCount} / {limits.max_drivers === -1 ? "ilimitado" : limits.max_drivers}
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Veículos da casa: </span>
                        <span className="font-medium">
                          {vehiclesCount} / {limits.max_vehicles === -1 ? "ilimitado" : limits.max_vehicles}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: "Dashboard e mapa em tempo real", enabled: limits.realtime },
                      { label: "Importação de XML em lote", enabled: limits.batch_import },
                      { label: "SLA semanal e histórico", enabled: limits.sla_weekly },
                      { label: "Detalhamento do SLA por motorista", enabled: limits.sla_drilldown },
                      { label: "Acerto financeiro e rentabilidade", enabled: limits.financial_dashboard },
                    ].map((feature) => (
                      <div
                        key={feature.label}
                        className={cn("flex items-center gap-2 text-sm", !feature.enabled && "text-muted-foreground line-through")}
                      >
                        <Check className={cn("h-4 w-4", feature.enabled ? "text-success" : "text-muted-foreground/40")} />
                        <span>{feature.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Pagamento e contratação
                </CardTitle>
                <CardDescription>
                  As faturas (boleto ou PIX) são emitidas pela equipe Na Hora Frota e enviadas para o e-mail da empresa.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button asChild className="gap-2">
                  <a
                    href={`mailto:suporte@nahorafrota.com.br?subject=${encodeURIComponent(
                      `${isTrial ? "Contratar plano" : "Fatura / 2ª via"} - ${access?.razao_social || ""}`,
                    )}`}
                  >
                    <Mail className="h-4 w-4" />
                    {isTrial ? "Contratar um plano" : "Pedir 2ª via ou mudar de plano"}
                  </a>
                </Button>
                <p className="text-xs text-muted-foreground self-center">suporte@nahorafrota.com.br</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: User Management */}
          <TabsContent value="users" className="space-y-6">
            {/* Plan Limit Banner */}
            {!planLimitsLoading && (
              <PlanLimitBanner
                plan={plan}
                resourceLabel="usuários de sistema"
                currentCount={systemUsersCount}
                maxCount={limits.max_users}
                planLabels={pLabels}
              />
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-semibold">Usuários do Sistema</h2>
                <p className="text-sm text-muted-foreground">
                  {isLoading ? "Carregando..." : `${users.length} usuário(s) cadastrado(s)`}
                  {limits.max_users !== -1 && ` • Limite de Painel: ${systemUsersCount}/${limits.max_users}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={refetch}
                  disabled={isLoading}
                  aria-label="Atualizar lista de usuários"
                  title="Atualizar lista de usuários"
                >
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                </Button>
                <CreateUserDialog onUserCreated={refetch} />
                <InviteUserDialog onUserInvited={refetch} />
                {canAddDriver ? (
                  <CreateDriverModal onUserCreated={refreshAdminLists} />
                ) : (
                  <Button disabled className="gap-2 opacity-50">
                    <UserPlus className="h-4 w-4" />
                    Limite de Motoristas atingido
                  </Button>
                )}
              </div>
            </div>

            {/* Error State */}
            {error && (
              <Card className="border-destructive/50 bg-destructive/10">
                <CardContent className="pt-6">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button variant="outline" size="sm" onClick={refetch} className="mt-2">
                    Tentar novamente
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Users Table */}
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2 text-muted-foreground">Carregando usuários...</span>
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum usuário cadastrado</p>
                    <p className="text-sm">Clique em "Criar Usuário" para adicionar</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Permissão</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((systemUser) => {
                        const config = roleConfig[systemUser.role] || roleConfig.viewer;
                        const isCurrentUser = systemUser.user_id === user?.id;
                        
                        return (
                          <TableRow key={systemUser.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                                  {systemUser.avatar_url ? (
                                    <img 
                                      src={systemUser.avatar_url} 
                                      alt={systemUser.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-sm font-semibold text-primary">
                                      {systemUser.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium flex items-center gap-2">
                                    {systemUser.name}
                                    {isCurrentUser && (
                                      <Badge variant="outline" className="text-xs">Você</Badge>
                                    )}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{systemUser.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={systemUser.role}
                                onValueChange={(value) => handleRoleChange(systemUser.user_id, value as SystemUser['role'])}
                                disabled={isCurrentUser}
                              >
                                <SelectTrigger className="w-[160px]">
                                  <SelectValue>
                                    <Badge className={config.className}>{config.label}</Badge>
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(roleConfig)
                                    .filter(([value]) => value !== "viewer")
                                    .map(([value, cfg]) => (
                                    <SelectItem key={value} value={value}>
                                      <Badge className={cfg.className}>{cfg.label}</Badge>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(systemUser.created_at).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditTarget({ type: "user", record: systemUser })}
                                title="Editar usuário"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => setUserToDelete({ id: systemUser.user_id, name: systemUser.name })}
                                disabled={isCurrentUser}
                                title={isCurrentUser ? "Você não pode remover seu próprio usuário" : "Remover usuário"}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Drivers Table */}
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  Motoristas do App
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isLoadingDrivers ? "Carregando..." : `${drivers.length} motorista(s) cadastrado(s)`}
                  {limits.max_drivers !== -1 && ` • Limite de Motoristas: ${driversCount}/${limits.max_drivers}`}
                </p>
              </div>

              {driversError && (
                <Card className="border-destructive/50 bg-destructive/10">
                  <CardContent className="pt-6">
                    <p className="text-sm text-destructive">{driversError}</p>
                    <Button variant="outline" size="sm" onClick={fetchDrivers} className="mt-2">
                      Tentar novamente
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-0">
                  {isLoadingDrivers ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="ml-2 text-muted-foreground">Carregando motoristas...</span>
                    </div>
                  ) : drivers.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum motorista cadastrado</p>
                      <p className="text-sm">Clique em "Criar Motorista" para adicionar</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Motorista</TableHead>
                          <TableHead>Veículo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Criado em</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drivers.map((driver) => (
                          <TableRow key={driver.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                                  {driver.avatar || driver.photo ? (
                                    <img
                                      src={driver.avatar || driver.photo}
                                      alt={driver.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-sm font-semibold text-primary">
                                      {driver.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium">{driver.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {driver.email || driver.cpf}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{driver.vehicle_type || "Veículo"}</p>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {driver.vehicle_plate || "-"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {driver.status === "active"
                                  ? "Disponível"
                                  : driver.status === "in_route"
                                    ? "Em Rota"
                                    : driver.status === "inactive"
                                      ? "Inativo"
                                      : driver.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(driver.created_at).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditTarget({ type: "driver", record: driver })}
                                disabled={!driver.user_id}
                                title={driver.user_id ? "Editar motorista" : "Motorista sem login vinculado"}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <EditAccessDialog
        target={editTarget}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onSaved={refreshAdminLists}
      />
      {/* Confirmacao antes de remover (antes apagava no primeiro clique) */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && !isDeletingUser && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              {userToDelete?.name} perde o acesso ao painel imediatamente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingUser}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingUser}
              onClick={async (event) => {
                event.preventDefault();
                if (!userToDelete) return;
                setIsDeletingUser(true);
                try {
                  await handleDeleteUser(userToDelete.id, userToDelete.name);
                } finally {
                  setIsDeletingUser(false);
                }
              }}
            >
              {isDeletingUser ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
