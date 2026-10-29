import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Building2, CheckCircle2, Crown, DollarSign, Filter, Gift, Hourglass, RefreshCw, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CardsSkeleton, ConfirmDialog, EmptyState, FilterBar, FilterStatCard, ListSkeleton, PageHeader, SearchInput, Section, StatCard,
} from "@/components/patterns";
import { toast } from "@/hooks/use-toast";
import { usePlatformAdmin, TenantData } from "@/hooks/usePlatformAdmin";
import { supabase } from "@/integrations/supabase/client";
import { BillingDialog } from "@/components/master/BillingDialog";
import { getDueSoonCount, getOverdueCount, isOverdue } from "@/components/master/dueDates";
import { PlatformAdminsCard } from "@/components/master/PlatformAdminsCard";
import { TenantsList } from "@/components/master/TenantsList";
import { TENANT_STATUS, planLabel, tenantStatusKey } from "@/components/master/tenantStatus";
import { isTrialExpired } from "@/lib/billingStatus";
import { FunnelAnalytics } from "@/components/master/FunnelAnalytics";

type StatusFilter = "all" | "active" | "trial" | "trial_expired" | "inactive" | "blocked" | "overdue";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todas as situações" },
  { value: "active", label: "Ativas" },
  { value: "trial", label: "Em teste" },
  { value: "trial_expired", label: "Teste expirado" },
  { value: "inactive", label: "Aguardando liberação" },
  { value: "blocked", label: "Bloqueadas" },
  { value: "overdue", label: "Com pagamento atrasado" },
];

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

// Erros do banco vem em ingles: na tela, uma frase simples.
const SAVE_ERROR = "Tente de novo em instantes. Se continuar, atualize a página.";

type PlanLimitsSummary = { max_users: number; max_drivers: number };

// Usado so enquanto os limites do banco (get_plan_limits) carregam.
const FALLBACK_PLAN_LIMITS: Record<string, PlanLimitsSummary> = {
  basic: { max_users: 1, max_drivers: 5 },
  control: { max_users: 20, max_drivers: 200 },
  total: { max_users: -1, max_drivers: -1 },
};

/** Limites de cada plano como o banco aplica (antes eram fixos aqui e divergiam). */
function usePlanLimitsMap(): Record<string, PlanLimitsSummary> {
  const { data } = useQuery({
    queryKey: ["plan-limits-map"],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const entries = await Promise.all(
        Object.keys(FALLBACK_PLAN_LIMITS).map(async (plan) => {
          const { data: limits } = await supabase.rpc("get_plan_limits", { p_plan: plan });
          const parsed = (typeof limits === "string" ? JSON.parse(limits) : limits) as Partial<PlanLimitsSummary> | null;
          return [
            plan,
            {
              max_users: Number(parsed?.max_users ?? FALLBACK_PLAN_LIMITS[plan].max_users),
              max_drivers: Number(parsed?.max_drivers ?? FALLBACK_PLAN_LIMITS[plan].max_drivers),
            },
          ] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, PlanLimitsSummary>;
    },
  });
  return data ?? FALLBACK_PLAN_LIMITS;
}

export default function MasterAdminPage() {
  const { isPlatformAdmin, checking, tenants, isLoading, fetchTenants, updateTenantStatus, updateTenantPlan, extendTrial } = usePlatformAdmin();
  const planLimitsMap = usePlanLimitsMap();
  // Empresa em teste usa todos os recursos (o banco trata o teste como plano Total).
  const limitsFor = (tenant: TenantData) =>
    tenant.status === "trial" && !isTrialExpired(tenant)
      ? planLimitsMap.total
      : planLimitsMap[tenant.plan] || planLimitsMap.basic;
  const [billingTenant, setBillingTenant] = useState<TenantData | null>(null);
  const [extendingTenantId, setExtendingTenantId] = useState<string | null>(null);
  const [blockTarget, setBlockTarget] = useState<TenantData | null>(null);
  const [tab, setTab] = useState("clients");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Filtro so de tela (busca por nome, CNPJ ou responsavel + situacao).
  const filteredTenants = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    return tenants.filter((tenant) => {
      if (statusFilter === "overdue" ? !isOverdue(tenant) : statusFilter !== "all" && tenantStatusKey(tenant) !== statusFilter) {
        return false;
      }
      if (!term) return true;
      return (
        tenant.razao_social.toLowerCase().includes(term) ||
        (tenant.admin_name || "").toLowerCase().includes(term) ||
        (tenant.admin_email || "").toLowerCase().includes(term) ||
        (!!digits && tenant.cnpj.replace(/\D/g, "").includes(digits))
      );
    });
  }, [tenants, search, statusFilter]);

  if (checking) {
    return (
      <div role="status" aria-label="Carregando" className="space-y-8">
        <CardsSkeleton count={4} />
        <ListSkeleton rows={5} />
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return <Navigate to="/" replace />;
  }

  const activeTenants = tenants.filter(t => t.status === 'active').length;
  const pendingTenants = tenants.filter(t => t.status === 'inactive').length;
  const trialTenants = tenants.filter(t => t.status === 'trial' && !isTrialExpired(t)).length;
  const expiredTrialTenants = tenants.filter(t => isTrialExpired(t)).length;
  const totalUsers = tenants.reduce((acc, t) => acc + (t.members_count || 0), 0);
  const dueSoonCount = getDueSoonCount(tenants, 5);
  const overdueCount = getOverdueCount(tenants);

  // Indicador que filtra: clicar de novo no ativo volta para "todas".
  const showClients = (filter: StatusFilter) => {
    setTab("clients");
    setStatusFilter((current) => (current === filter ? "all" : filter));
    requestAnimationFrame(() => document.getElementById("clientes")?.scrollIntoView({ block: "start" }));
  };

  const handleStatusChange = async (tenant: TenantData, newStatus: string) => {
    const { error } = await updateTenantStatus(tenant.id, newStatus);
    if (error) {
      console.error("Tenant status error:", error);
      toast({ title: "Não foi possível mudar a situação", description: SAVE_ERROR, variant: "destructive" });
    } else {
      toast({
        title: "Situação atualizada",
        description: `${tenant.razao_social} agora está ${(TENANT_STATUS[newStatus]?.label || newStatus).toLowerCase()}.`,
        variant: "success",
      });
    }
  };

  const handleExtendTrial = async (tenant: TenantData) => {
    setExtendingTenantId(tenant.id);
    const { error } = await extendTrial(tenant.id, 7);
    setExtendingTenantId(null);
    if (error) {
      console.error("Extend trial error:", error);
      toast({ title: "Não foi possível estender o teste", description: SAVE_ERROR, variant: "destructive" });
    } else {
      toast({ title: "Teste estendido", description: `${tenant.razao_social} ganhou mais 7 dias de teste grátis.`, variant: "success" });
    }
  };

  const handlePlanChange = async (tenant: TenantData, newPlan: string) => {
    const { error } = await updateTenantPlan(tenant.id, newPlan);
    if (error) {
      console.error("Tenant plan error:", error);
      toast({ title: "Não foi possível mudar o plano", description: SAVE_ERROR, variant: "destructive" });
    } else {
      toast({ title: "Plano atualizado", description: `${tenant.razao_social} agora está no plano ${planLabel(newPlan)}.`, variant: "success" });
    }
  };

  const filtering = statusFilter !== "all" || search.trim() !== "";

  return (
    <>
      <PageHeader
        icon={Crown}
        title="Painel Master"
        description="Empresas da plataforma, testes grátis e cobranças."
        actions={
          <Button variant="outline" onClick={fetchTenants} disabled={isLoading}>
            <RefreshCw className={isLoading ? "animate-spin" : undefined} aria-hidden="true" />
            Atualizar dados
          </Button>
        }
      />

      <div className="space-y-6 md:space-y-8">
        {/* Aviso de cobrancas */}
        {(dueSoonCount > 0 || overdueCount > 0) && (
          <Alert variant={overdueCount > 0 ? "destructive" : "warning"} role="status" className="animate-fade-in">
            <AlertTriangle aria-hidden="true" />
            <AlertDescription className="flex flex-col gap-3 text-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                {overdueCount > 0 && <strong className="font-semibold">{plural(overdueCount, "cliente com pagamento atrasado", "clientes com pagamento atrasado")}. </strong>}
                {dueSoonCount > 0 && <span>{plural(dueSoonCount, "cliente vence", "clientes vencem")} nos próximos 5 dias.</span>}
              </span>
              {overdueCount > 0 && (
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => showClients("overdue")}>
                  Ver atrasados
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Indicadores */}
        {/* Indicadores que filtram a lista (marcado = filtro ligado) */}
        <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
          <StatCard
            label="Empresas"
            value={tenants.length}
            icon={Building2}
            loading={isLoading}
            hint="Ver todas"
            onClick={() => showClients("all")}
            className="min-h-0 gap-2 p-4 sm:min-h-[7.5rem] sm:gap-3 sm:p-5"
          />
          <FilterStatCard
            label="Ativas"
            value={activeTenants}
            icon={CheckCircle2}
            tone="success"
            loading={isLoading}
            pressed={statusFilter === "active"}
            onPressedChange={() => showClients("active")}
          />
          <FilterStatCard
            label="Em teste"
            value={trialTenants}
            icon={Gift}
            tone="info"
            loading={isLoading}
            hint={expiredTrialTenants > 0 ? plural(expiredTrialTenants, "teste expirado", "testes expirados") : undefined}
            pressed={statusFilter === "trial"}
            onPressedChange={() => showClients("trial")}
          />
          <FilterStatCard
            label="Aguardando liberação"
            value={pendingTenants}
            icon={Hourglass}
            tone="warning"
            loading={isLoading}
            pressed={statusFilter === "inactive"}
            onPressedChange={() => showClients("inactive")}
          />
          <StatCard
            label="Usuários"
            value={totalUsers}
            icon={Users}
            tone="neutral"
            loading={isLoading}
            hint="Em todas as empresas"
            className="min-h-0 gap-2 p-4 sm:min-h-[7.5rem] sm:gap-3 sm:p-5"
          />
          <FilterStatCard
            label="Inadimplentes"
            value={overdueCount}
            icon={DollarSign}
            tone={overdueCount > 0 ? "danger" : "neutral"}
            loading={isLoading}
            pressed={statusFilter === "overdue"}
            onPressedChange={() => showClients("overdue")}
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
            <TabsTrigger value="clients">
              <Building2 aria-hidden="true" />
              Clientes
            </TabsTrigger>
            <TabsTrigger value="funnel">
              <Filter aria-hidden="true" />
              Funil de aquisição
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clients" className="mt-6">
            <Section
              id="clientes"
              className="scroll-mt-24"
              title="Clientes cadastrados"
              description={
                filtering
                  ? `${plural(filteredTenants.length, "empresa encontrada", "empresas encontradas")} de ${tenants.length}`
                  : `${plural(tenants.length, "empresa", "empresas")} na plataforma`
              }
            >
              <FilterBar>
                <SearchInput
                  label="Buscar empresa"
                  placeholder="Nome, CNPJ ou responsável"
                  value={search}
                  onChange={setSearch}
                />
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                  <SelectTrigger className="w-full sm:w-[15rem]" aria-label="Filtrar por situação">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTERS.map((filter) => (
                      <SelectItem key={filter.value} value={filter.value}>
                        {filter.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filtering && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                    }}
                  >
                    Limpar filtros
                  </Button>
                )}
              </FilterBar>

              {isLoading && tenants.length === 0 ? (
                <ListSkeleton rows={5} />
              ) : tenants.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="Nenhum cliente cadastrado"
                  description="As empresas aparecem aqui assim que fizerem o cadastro do teste grátis."
                />
              ) : filteredTenants.length === 0 ? (
                <EmptyState
                  icon={Filter}
                  title="Nenhuma empresa com esses filtros"
                  description="Mude a busca ou a situação para ver mais empresas."
                  action={
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearch("");
                        setStatusFilter("all");
                      }}
                    >
                      Limpar filtros
                    </Button>
                  }
                />
              ) : (
                <TenantsList
                  tenants={filteredTenants}
                  limitsFor={limitsFor}
                  extendingTenantId={extendingTenantId}
                  onPlanChange={handlePlanChange}
                  onOpenBilling={setBillingTenant}
                  onExtendTrial={handleExtendTrial}
                  onStatusChange={handleStatusChange}
                  onRequestBlock={setBlockTarget}
                />
              )}
            </Section>
          </TabsContent>

          <TabsContent value="funnel" className="mt-6">
            <FunnelAnalytics tenants={tenants} onExtendTrial={handleExtendTrial} extendingTenantId={extendingTenantId} />
          </TabsContent>
        </Tabs>

        <PlatformAdminsCard />
      </div>

      <BillingDialog
        open={!!billingTenant}
        onOpenChange={(open) => { if (!open) setBillingTenant(null); }}
        tenant={billingTenant}
        onSaved={() => { fetchTenants(); }}
      />

      <ConfirmDialog
        open={!!blockTarget}
        onOpenChange={(open) => !open && setBlockTarget(null)}
        title={`Bloquear ${blockTarget?.razao_social ?? "empresa"}?`}
        description="Os usuários desta empresa não vão conseguir entrar no sistema. Você pode reativar depois."
        confirmLabel="Confirmar bloqueio"
        tone="danger"
        onConfirm={() => {
          if (blockTarget) handleStatusChange(blockTarget, "blocked");
          setBlockTarget(null);
        }}
      />
    </>
  );
}
