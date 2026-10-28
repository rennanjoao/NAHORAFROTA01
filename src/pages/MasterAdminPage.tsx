import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Crown, Building2, Users, ShieldAlert, CheckCircle2, XCircle,
  Loader2, RefreshCw, Ban, Monitor, Truck, DollarSign, AlertTriangle, Bell,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { usePlatformAdmin, TenantData } from "@/hooks/usePlatformAdmin";
import { Navigate } from "react-router-dom";
import { BillingDialog } from "@/components/master/BillingDialog";
import { DueDateIndicator, getDueSoonCount, getOverdueCount } from "@/components/master/DueDateIndicator";
import { PlatformAdminsCard } from "@/components/master/PlatformAdminsCard";

const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  active: { label: "Ativo", icon: <CheckCircle2 className="h-3 w-3" />, className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  inactive: { label: "Aguardando", icon: <Loader2 className="h-3 w-3" />, className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  blocked: { label: "Bloqueado", icon: <Ban className="h-3 w-3" />, className: "bg-destructive/20 text-destructive border-destructive/30" },
};

const planConfig: Record<string, { label: string; className: string }> = {
  basic: { label: "Basic", className: "bg-muted text-muted-foreground" },
  control: { label: "Control", className: "bg-primary/20 text-primary" },
  total: { label: "Total", className: "bg-amber-500/20 text-amber-400" },
};

const planLimitsMap: Record<string, { max_users: number; max_drivers: number }> = {
  basic: { max_users: 1, max_drivers: 5 },
  control: { max_users: 5, max_drivers: 20 },
  total: { max_users: -1, max_drivers: -1 },
};

export default function MasterAdminPage() {
  const { isPlatformAdmin, checking, tenants, isLoading, fetchTenants, updateTenantStatus, updateTenantPlan } = usePlatformAdmin();
  const [billingTenant, setBillingTenant] = useState<TenantData | null>(null);

  if (checking) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!isPlatformAdmin) {
    return <Navigate to="/" replace />;
  }

  const activeTenants = tenants.filter(t => t.status === 'active').length;
  const pendingTenants = tenants.filter(t => t.status === 'inactive').length;
  const totalUsers = tenants.reduce((acc, t) => acc + (t.members_count || 0), 0);
  const dueSoonCount = getDueSoonCount(tenants, 5);
  const overdueCount = getOverdueCount(tenants);

  const handleStatusChange = async (tenant: TenantData, newStatus: string) => {
    const { error } = await updateTenantStatus(tenant.id, newStatus);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Status atualizado", description: `${tenant.razao_social} agora está ${statusConfig[newStatus]?.label || newStatus}.` });
    }
  };

  const handlePlanChange = async (tenant: TenantData, newPlan: string) => {
    const { error } = await updateTenantPlan(tenant.id, newPlan);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Plano atualizado", description: `${tenant.razao_social} agora no plano ${planConfig[newPlan]?.label || newPlan}.` });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Crown className="h-7 w-7 text-amber-400" />
            Painel Master
          </h1>
          <p className="text-muted-foreground">Gestão de clientes e planos da plataforma</p>
        </div>

        {/* Billing Alert Banner */}
        {(dueSoonCount > 0 || overdueCount > 0) && (
          <div className="flex items-center gap-3 rounded-lg border p-3 bg-yellow-500/5 border-yellow-500/30">
            <Bell className="h-5 w-5 text-yellow-400 flex-shrink-0" />
            <div className="flex-1 text-sm">
              {overdueCount > 0 && (
                <span className="text-destructive font-medium mr-3">
                  <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                  {overdueCount} cliente(s) com pagamento atrasado
                </span>
              )}
              {dueSoonCount > 0 && (
                <span className="text-yellow-400">
                  {dueSoonCount} cliente(s) com vencimento nos próximos 5 dias
                </span>
              )}
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Building2 className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{tenants.length}</p>
                  <p className="text-xs text-muted-foreground">Total Clientes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                <div>
                  <p className="text-2xl font-bold">{activeTenants}</p>
                  <p className="text-xs text-muted-foreground">Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-8 w-8 text-yellow-400" />
                <div>
                  <p className="text-2xl font-bold">{pendingTenants}</p>
                  <p className="text-xs text-muted-foreground">Aguardando</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-400" />
                <div>
                  <p className="text-2xl font-bold">{totalUsers}</p>
                  <p className="text-xs text-muted-foreground">Total Usuários</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-amber-400" />
                <div>
                  <p className="text-2xl font-bold text-destructive">{overdueCount}</p>
                  <p className="text-xs text-muted-foreground">Inadimplentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tenants Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Clientes Cadastrados</CardTitle>
            <Button variant="outline" size="icon" onClick={fetchTenants} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : tenants.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum cliente cadastrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Licenças</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((tenant) => {
                      const sc = statusConfig[tenant.status] || statusConfig.inactive;
                      const pc = planConfig[tenant.plan] || planConfig.basic;
                      return (
                        <TableRow key={tenant.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{tenant.razao_social}</p>
                              <p className="text-xs text-muted-foreground">{tenant.cnpj}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm">{tenant.admin_name || "—"}</p>
                              <p className="text-xs text-muted-foreground">{tenant.admin_email || ""}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={tenant.plan}
                              onValueChange={(v) => handlePlanChange(tenant, v)}
                            >
                              <SelectTrigger className="w-[120px] h-8">
                                <SelectValue>
                                  <Badge variant="outline" className={pc.className}>{pc.label}</Badge>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(planConfig).map(([val, cfg]) => (
                                  <SelectItem key={val} value={val}>
                                    <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`gap-1 ${sc.className}`}>
                              {sc.icon} {sc.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <div className="flex flex-col gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1.5 text-sm">
                                      <Monitor className="h-3.5 w-3.5 text-primary" />
                                      <span className="font-medium">{tenant.system_users_count || 0}</span>
                                      <span className="text-muted-foreground">/</span>
                                      <span className="text-muted-foreground">
                                        {(planLimitsMap[tenant.plan] || planLimitsMap.basic).max_users === -1 ? '∞' : (planLimitsMap[tenant.plan] || planLimitsMap.basic).max_users}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>Licenças de Painel (Usuários de Sistema)</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1.5 text-sm">
                                      <Truck className="h-3.5 w-3.5 text-emerald-400" />
                                      <span className="font-medium">{tenant.drivers_count || 0}</span>
                                      <span className="text-muted-foreground">/</span>
                                      <span className="text-muted-foreground">
                                        {(planLimitsMap[tenant.plan] || planLimitsMap.basic).max_drivers === -1 ? '∞' : (planLimitsMap[tenant.plan] || planLimitsMap.basic).max_drivers}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>Licenças de App (Motoristas)</TooltipContent>
                                </Tooltip>
                              </div>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <div
                                className="cursor-pointer"
                                onClick={() => setBillingTenant(tenant)}
                              >
                                <DueDateIndicator
                                  nextDueDate={tenant.next_due_date || null}
                                  financialStatus={tenant.financial_status || null}
                                />
                              </div>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(tenant.created_at).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-primary"
                                onClick={() => setBillingTenant(tenant)}
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>
                              {tenant.status === 'inactive' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                                  onClick={() => handleStatusChange(tenant, 'active')}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
                                </Button>
                              )}
                              {tenant.status === 'active' && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                                      <XCircle className="h-4 w-4 mr-1" /> Bloquear
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Bloquear {tenant.razao_social}?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Os usuários desta empresa não conseguirão acessar o sistema. Você pode reativar depois.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground"
                                        onClick={() => handleStatusChange(tenant, 'blocked')}
                                      >
                                        Confirmar Bloqueio
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              {tenant.status === 'blocked' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                                  onClick={() => handleStatusChange(tenant, 'active')}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" /> Reativar
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Platform Admins Management */}
        <PlatformAdminsCard />
      </div>

      {/* Billing Dialog */}
      <BillingDialog
        open={!!billingTenant}
        onOpenChange={(open) => { if (!open) setBillingTenant(null); }}
        tenant={billingTenant}
        onSaved={() => { fetchTenants(); }}
      />
    </AppLayout>
  );
}
