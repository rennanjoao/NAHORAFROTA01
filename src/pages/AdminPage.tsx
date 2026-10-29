import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Car, CreditCard, Crown, Lock, RefreshCw, ShieldCheck, Truck, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog, PageHeader, Section, StatCard } from "@/components/patterns";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CreateDriverModal } from "@/components/admin/CreateDriverModal";
import { InviteUserDialog } from "@/components/admin/InviteUserDialog";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { AdminUsersList } from "@/components/admin/AdminUsersList";
import { AdminDriversList } from "@/components/admin/AdminDriversList";
import { AdminPlanPanel } from "@/components/admin/AdminPlanPanel";
import { useSystemUsers, SystemUser } from "@/hooks/useSystemUsers";
import { useDriversDB } from "@/hooks/useDriversDB";
import { EditAccessDialog } from "@/components/admin/EditAccessDialog";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { PlanLimitBanner } from "@/components/plan/PlanLimitBanner";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";

type AdminTab = "users" | "plans";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const limitHint = (max: number) => (max === -1 ? "Sem limite no plano" : `de ${max} no plano`);

export default function AdminPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: AdminTab = searchParams.get("tab") === "plans" ? "plans" : "users";
  const { users, isLoading, error, refetch, updateUserRole, deleteUser } = useSystemUsers();
  const {
    drivers,
    isLoading: isLoadingDrivers,
    error: driversError,
    fetchDrivers,
  } = useDriversDB();
  const {
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
  const { status: subscriptionStatus, daysRemaining } = useSubscriptionStatus();
  const isTrial = subscriptionStatus === "trial";

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

  const changeTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "users") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  // Abre a aba e rola ate o bloco (os indicadores do topo levam ate a lista).
  const goTo = (value: AdminTab, sectionId?: string) => {
    changeTab(value);
    if (sectionId) requestAnimationFrame(() => document.getElementById(sectionId)?.scrollIntoView({ block: "start" }));
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    // Nao deixa remover a si mesmo
    if (userId === user?.id) {
      toast({
        title: "Ação não permitida",
        description: "Você não pode remover seu próprio usuário.",
        variant: "destructive",
      });
      return;
    }

    // Nao deixa remover o ultimo administrador
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
    // A linha some: o foco vai para o titulo da lista (e nao para o topo da pagina).
    window.setTimeout(() => {
      const heading = document.getElementById("usuarios-titulo");
      if (!heading) return;
      heading.setAttribute("tabindex", "-1");
      heading.focus();
    }, 0);
  };

  const handleRoleChange = async (userId: string, newRole: SystemUser['role']) => {
    await updateUserRole(userId, newRole);
  };

  const planValue = isTrial ? "Teste grátis" : pLabels[contractedPlan] || contractedPlan;
  const planHint = isTrial
    ? daysRemaining <= 0
      ? "Termina hoje"
      : `${plural(daysRemaining, "dia restante", "dias restantes")}`
    : subscriptionStatus === "overdue" || subscriptionStatus === "expired"
      ? "Pagamento pendente"
      : "Ver plano e cobrança";

  return (
    <>
      <PageHeader
        icon={ShieldCheck}
        title="Administração"
        description="Quem usa o painel, os motoristas do aplicativo e o plano da empresa."
      />

      <div className="space-y-6 md:space-y-8">
        <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Usuários do painel"
            value={systemUsersCount}
            icon={Users}
            hint={limitHint(limits.max_users)}
            loading={planLimitsLoading}
            onClick={() => goTo("users", "usuarios")}
          />
          <StatCard
            label="Motoristas do app"
            value={driversCount}
            icon={Truck}
            tone="info"
            hint={limitHint(limits.max_drivers)}
            loading={planLimitsLoading}
            onClick={() => goTo("users", "motoristas")}
          />
          <StatCard
            label="Veículos da casa"
            value={vehiclesCount}
            icon={Car}
            tone="neutral"
            hint={limitHint(limits.max_vehicles)}
            loading={planLimitsLoading}
            href="/vehicles"
          />
          <StatCard
            label="Plano"
            value={planValue}
            icon={Crown}
            tone={subscriptionStatus === "overdue" || subscriptionStatus === "expired" ? "danger" : "brand"}
            hint={planHint}
            loading={planLimitsLoading}
            onClick={() => goTo("plans")}
          />
        </div>

        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
            <TabsTrigger value="users" className="min-h-[2.5rem] whitespace-normal px-2 text-center leading-tight sm:min-h-0 sm:whitespace-nowrap sm:px-3">
              <Users aria-hidden="true" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="plans" className="min-h-[2.5rem] whitespace-normal px-2 text-center leading-tight sm:min-h-0 sm:whitespace-nowrap sm:px-3">
              <CreditCard aria-hidden="true" />
              Plano e cobrança
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6 space-y-10">
            <Section
              id="usuarios"
              className="scroll-mt-24"
              title="Usuários do painel"
              description={
                isLoading && users.length === 0
                  ? "Carregando..."
                  : `${plural(users.length, "pessoa com acesso", "pessoas com acesso")} ao painel${
                      limits.max_users !== -1 ? ` · limite do plano: ${limits.max_users}` : ""
                    }`
              }
              actions={
                // No celular: botoes inteiros, o principal em cima.
                <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center [&>button]:max-sm:w-full">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => !isLoading && refetch()}
                        aria-disabled={isLoading || undefined}
                        aria-label="Atualizar lista de usuários"
                        className="max-sm:hidden aria-disabled:pointer-events-none aria-disabled:opacity-60"
                      >
                        <RefreshCw className={cn(isLoading && "animate-spin")} aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Atualizar lista</TooltipContent>
                  </Tooltip>
                  <InviteUserDialog onUserInvited={refetch} />
                  <CreateUserDialog onUserCreated={refetch} />
                </div>
              }
            >
              {!planLimitsLoading && (
                <PlanLimitBanner
                  plan={plan}
                  resourceLabel="usuários do painel"
                  currentCount={systemUsersCount}
                  maxCount={limits.max_users}
                  planLabels={pLabels}
                />
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription className="flex flex-col gap-3 text-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>Não foi possível carregar os usuários: {error}</span>
                    <Button variant="outline" size="sm" onClick={refetch} className="shrink-0">
                      Tentar de novo
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <AdminUsersList
                users={users}
                isLoading={isLoading}
                currentUserId={user?.id}
                onRoleChange={handleRoleChange}
                onEdit={(record) => setEditTarget({ type: "user", record })}
                onRemove={(record) => setUserToDelete({ id: record.user_id, name: record.name })}
              />
            </Section>

            <Section
              id="motoristas"
              className="scroll-mt-24"
              title="Motoristas do app"
              description={
                isLoadingDrivers && drivers.length === 0
                  ? "Carregando..."
                  : `${plural(drivers.length, "motorista cadastrado", "motoristas cadastrados")}${
                      limits.max_drivers !== -1 ? ` · limite do plano: ${limits.max_drivers}` : ""
                    }`
              }
              actions={
                <div className="flex w-full sm:w-auto [&>button]:max-sm:w-full">
                  {canAddDriver ? (
                    <CreateDriverModal onUserCreated={refreshAdminLists} />
                  ) : (
                    <Button disabled>
                      <Lock aria-hidden="true" />
                      Limite de motoristas atingido
                    </Button>
                  )}
                </div>
              }
            >
              {!planLimitsLoading && (
                <PlanLimitBanner
                  plan={plan}
                  resourceLabel="motoristas"
                  currentCount={driversCount}
                  maxCount={limits.max_drivers}
                  planLabels={pLabels}
                />
              )}

              {driversError && (
                <Alert variant="destructive">
                  <AlertDescription className="flex flex-col gap-3 text-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>Não foi possível carregar os motoristas: {driversError}</span>
                    <Button variant="outline" size="sm" onClick={fetchDrivers} className="shrink-0">
                      Tentar de novo
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <AdminDriversList
                drivers={drivers}
                isLoading={isLoadingDrivers}
                onEdit={(record) => setEditTarget({ type: "driver", record })}
              />
            </Section>
          </TabsContent>

          <TabsContent value="plans" className="mt-6">
            <AdminPlanPanel />
          </TabsContent>
        </Tabs>
      </div>

      <EditAccessDialog
        target={editTarget}
        takenEmails={[...users.map((u) => u.email), ...drivers.map((d) => d.email || "")]}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onSaved={refreshAdminLists}
      />
      {/* Confirmacao antes de remover (antes apagava no primeiro clique) */}
      <ConfirmDialog
        open={!!userToDelete}
        onOpenChange={(open) => !open && !isDeletingUser && setUserToDelete(null)}
        title={`Remover ${userToDelete?.name ?? "usuário"}?`}
        description="A pessoa perde o acesso ao painel na hora. Esta ação não pode ser desfeita."
        confirmLabel={isDeletingUser ? "Removendo..." : "Remover usuário"}
        tone="danger"
        loading={isDeletingUser}
        onConfirm={async () => {
          if (!userToDelete) return;
          setIsDeletingUser(true);
          try {
            await handleDeleteUser(userToDelete.id, userToDelete.name);
          } finally {
            setIsDeletingUser(false);
          }
        }}
      />
    </>
  );
}
