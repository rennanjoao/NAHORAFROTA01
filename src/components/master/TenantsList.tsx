import { Ban, CalendarPlus, CheckCircle2, DollarSign, Loader2, Monitor, MoreHorizontal, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/patterns";
import type { TenantData } from "@/hooks/usePlatformAdmin";
import { DueDateIndicator } from "./DueDateIndicator";
import { BillingNoticeBadge, TrialIndicator } from "./TrialIndicator";
import { PLAN_OPTIONS, planLabel, tenantStatus } from "./tenantStatus";

type PlanLimitsSummary = { max_users: number; max_drivers: number };

export interface TenantsListProps {
  tenants: TenantData[];
  limitsFor: (tenant: TenantData) => PlanLimitsSummary;
  extendingTenantId: string | null;
  onPlanChange: (tenant: TenantData, plan: string) => void;
  onOpenBilling: (tenant: TenantData) => void;
  onExtendTrial: (tenant: TenantData) => void;
  onStatusChange: (tenant: TenantData, status: string) => void;
  /** Pede confirmacao antes de bloquear. */
  onRequestBlock: (tenant: TenantData) => void;
}

const formatDate = (value: string) => new Date(value).toLocaleDateString("pt-BR");
function LimitValue({ value }: { value: number }) {
  if (value !== -1) return <>{value}</>;
  return (
    <>
      <span aria-hidden="true">∞</span>
      <span className="sr-only">sem limite</span>
    </>
  );
}

const companyName = (tenant: TenantData) => tenant.razao_social?.trim() || "Empresa sem nome";

function PlanSelect({ tenant, onPlanChange, className }: { tenant: TenantData; onPlanChange: TenantsListProps["onPlanChange"]; className?: string }) {
  return (
    <Select value={tenant.plan} onValueChange={(value) => onPlanChange(tenant, value)}>
      <SelectTrigger className={className} aria-label={`Plano de ${companyName(tenant)}`}>
        <SelectValue>{planLabel(tenant.plan)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PLAN_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Licenses({ tenant, limits }: { tenant: TenantData; limits: PlanLimitsSummary }) {
  return (
    <span className="flex flex-col gap-1 whitespace-nowrap text-sm">
      <span className="flex items-center gap-1.5">
        <Monitor className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="text-muted-foreground">Painel</span>
        <span className="font-data font-medium text-foreground">
          {tenant.system_users_count || 0}
          <span className="text-muted-foreground"> / <LimitValue value={limits.max_users} /></span>
        </span>
      </span>
      <span className="flex items-center gap-1.5">
        <Smartphone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="text-muted-foreground">App</span>
        <span className="font-data font-medium text-foreground">
          {tenant.drivers_count || 0}
          <span className="text-muted-foreground"> / <LimitValue value={limits.max_drivers} /></span>
        </span>
      </span>
    </span>
  );
}

function Billing({ tenant }: { tenant: TenantData }) {
  return (
    <span className="flex flex-col items-start gap-1">
      {tenant.status === "trial" ? (
        <TrialIndicator trialEndsAt={tenant.trial_ends_at} extensions={tenant.trial_extensions} />
      ) : (
        <DueDateIndicator nextDueDate={tenant.next_due_date || null} financialStatus={tenant.financial_status || null} />
      )}
      <BillingNoticeBadge notice={tenant.last_billing_notice} className="pl-1" />
    </span>
  );
}

/** Quais acoes de situacao cabem para a empresa (regras de antes, sem mudanca). */
function availableActions(tenant: TenantData) {
  const isTrial = tenant.status === "trial";
  // Bloqueada durante o teste e nunca contratou: volta ao teste, nao vira cliente ativo.
  const isBlockedTrial = tenant.status === "blocked" && !tenant.converted_at && !!tenant.trial_started_at;
  return {
    extend: isTrial || isBlockedTrial || tenant.status === "inactive",
    activate: isTrial || isBlockedTrial,
    approve: tenant.status === "inactive",
    block: tenant.status === "active" || isTrial,
    reactivate: tenant.status === "blocked" && !isBlockedTrial,
  };
}

/** Acoes de situacao da empresa em botoes (cartoes do celular). */
function TenantActions({
  tenant,
  extendingTenantId,
  onExtendTrial,
  onStatusChange,
  onRequestBlock,
  size,
}: Pick<TenantsListProps, "extendingTenantId" | "onExtendTrial" | "onStatusChange" | "onRequestBlock"> & {
  tenant: TenantData;
  size: "sm" | "default";
}) {
  const can = availableActions(tenant);
  const extending = extendingTenantId === tenant.id;
  const successClass = "text-success hover:text-success hover:bg-success/10";
  const name = companyName(tenant);

  return (
    <>
      {can.extend && (
        <Button
          size={size}
          variant="outline"
          disabled={extending}
          onClick={() => onExtendTrial(tenant)}
        >
          {extending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CalendarPlus aria-hidden="true" />}
          +7 dias
          <span className="sr-only"> de teste para {name}</span>
        </Button>
      )}
      {can.activate && (
        <Button size={size} variant="outline" className={successClass} onClick={() => onStatusChange(tenant, "active")}>
          <CheckCircle2 aria-hidden="true" />
          Ativar
          <span className="sr-only"> {name}</span>
        </Button>
      )}
      {can.approve && (
        <Button size={size} variant="outline" className={successClass} onClick={() => onStatusChange(tenant, "active")}>
          <CheckCircle2 aria-hidden="true" />
          Aprovar
          <span className="sr-only"> {name}</span>
        </Button>
      )}
      {can.block && (
        <Button
          size={size}
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onRequestBlock(tenant)}
        >
          <Ban aria-hidden="true" />
          Bloquear
          <span className="sr-only"> {name}</span>
        </Button>
      )}
      {can.reactivate && (
        <Button size={size} variant="outline" className={successClass} onClick={() => onStatusChange(tenant, "active")}>
          <CheckCircle2 aria-hidden="true" />
          Reativar
          <span className="sr-only"> {name}</span>
        </Button>
      )}
    </>
  );
}

/** Computador: uma acao principal visivel e o resto no menu "Mais acoes". */
function TenantRowActions({
  tenant,
  extendingTenantId,
  onExtendTrial,
  onStatusChange,
  onRequestBlock,
  onOpenBilling,
}: Pick<TenantsListProps, "extendingTenantId" | "onExtendTrial" | "onStatusChange" | "onRequestBlock" | "onOpenBilling"> & {
  tenant: TenantData;
}) {
  const can = availableActions(tenant);
  const name = companyName(tenant);
  const extending = extendingTenantId === tenant.id;
  const primary = can.extend && !can.approve ? "extend" : can.approve ? "approve" : can.reactivate ? "reactivate" : null;
  const menuItems = [
    can.extend && primary !== "extend" && { key: "extend", label: "Dar mais 7 dias de teste", icon: CalendarPlus, run: () => onExtendTrial(tenant) },
    can.activate && { key: "activate", label: "Ativar assinatura", icon: CheckCircle2, run: () => onStatusChange(tenant, "active") },
    can.block && { key: "block", label: "Bloquear acesso", icon: Ban, run: () => onRequestBlock(tenant), danger: true },
  ].filter(Boolean) as { key: string; label: string; icon: typeof Ban; run: () => void; danger?: boolean }[];

  return (
    <div className="flex items-center justify-end gap-1">

      {primary === "extend" && (
        <Button size="sm" variant="outline" disabled={extending} onClick={() => onExtendTrial(tenant)}>
          {extending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CalendarPlus aria-hidden="true" />}
          +7 dias
          <span className="sr-only"> de teste para {name}</span>
        </Button>
      )}
      {primary === "approve" && (
        <Button size="sm" variant="outline" className="text-success hover:bg-success/10 hover:text-success" onClick={() => onStatusChange(tenant, "active")}>
          <CheckCircle2 aria-hidden="true" />
          Aprovar
          <span className="sr-only"> {name}</span>
        </Button>
      )}
      {primary === "reactivate" && (
        <Button size="sm" variant="outline" className="text-success hover:bg-success/10 hover:text-success" onClick={() => onStatusChange(tenant, "active")}>
          <CheckCircle2 aria-hidden="true" />
          Reativar
          <span className="sr-only"> {name}</span>
        </Button>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="text-primary hover:text-primary"
            onClick={() => onOpenBilling(tenant)}
            aria-label={`Financeiro de ${name}`}
          >
            <DollarSign aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Financeiro</TooltipContent>
      </Tooltip>

      {menuItems.length > 0 ? (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-foreground" aria-label={`Mais ações para ${name}`}>
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Mais ações</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {menuItems.map(({ key, label, icon: Icon, run, danger }) => (
              <DropdownMenuItem
                key={key}
                onSelect={run}
                className={danger ? "text-destructive focus:bg-destructive/10 focus:text-destructive" : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="h-10 w-10" aria-hidden="true" />
      )}
    </div>
  );
}

/** Empresas da plataforma: tabela no computador, cartoes no celular e tablet. */
export function TenantsList(props: TenantsListProps) {
  const { tenants, limitsFor, onPlanChange, onOpenBilling } = props;

  return (
    <>
      {/* Computador */}
      <Card className="hidden overflow-hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead className="w-[11.5rem]">Situação e plano</TableHead>
              <TableHead>Licenças</TableHead>
              <TableHead>Cobrança</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((tenant) => {
              const status = tenantStatus(tenant);
              return (
                <TableRow key={tenant.id}>
                  <TableCell className="max-w-[18rem] px-3 first:pl-4">
                    <p className="truncate font-medium text-foreground">{companyName(tenant)}</p>
                    <p className="font-data text-xs text-muted-foreground">
                      {tenant.cnpj || "Sem CNPJ"} · desde {formatDate(tenant.created_at)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {tenant.admin_name || "Sem responsável"}
                      {tenant.admin_email ? ` · ${tenant.admin_email}` : ""}
                    </p>
                  </TableCell>
                  <TableCell className="px-3">
                    <div className="flex flex-col items-start gap-1.5">
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      <PlanSelect tenant={tenant} onPlanChange={onPlanChange} className="h-9 w-[10.5rem]" />
                    </div>
                  </TableCell>
                  <TableCell className="px-3">
                    <Licenses tenant={tenant} limits={limitsFor(tenant)} />
                  </TableCell>
                  <TableCell className="px-3">
                    <button
                      type="button"
                      onClick={() => onOpenBilling(tenant)}
                      className="-m-1.5 rounded-md p-1.5 text-left transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="sr-only">Abrir financeiro de {companyName(tenant)}: </span>
                      <Billing tenant={tenant} />
                    </button>
                  </TableCell>
                  <TableCell className="px-3 last:pr-4">
                    <TenantRowActions {...props} tenant={tenant} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Celular e tablet */}
      <ul className="stagger grid gap-3 md:grid-cols-2 lg:hidden">
        {tenants.map((tenant) => {
          const status = tenantStatus(tenant);
          return (
            <li key={tenant.id} className="flex flex-col rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{companyName(tenant)}</p>
                  <p className="font-data text-xs text-muted-foreground">{tenant.cnpj || "Sem CNPJ"}</p>
                </div>
                <StatusBadge tone={status.tone} className="shrink-0">
                  {status.label}
                </StatusBadge>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div className="col-span-2 min-w-0">
                  <dt className="text-xs text-muted-foreground">Responsável</dt>
                  <dd className="truncate text-foreground">
                    {tenant.admin_name || "Sem responsável"}
                    {tenant.admin_email && <span className="text-muted-foreground"> · {tenant.admin_email}</span>}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="mb-1 text-xs text-muted-foreground">Licenças</dt>
                  <dd>
                    <Licenses tenant={tenant} limits={limitsFor(tenant)} />
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="mb-1 text-xs text-muted-foreground">Cobrança</dt>
                  <dd>
                    <Billing tenant={tenant} />
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="mb-1 text-xs text-muted-foreground">Plano</dt>
                  <dd>
                    <PlanSelect tenant={tenant} onPlanChange={onPlanChange} />
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2 border-t pt-4 [&>*]:flex-1">
                <Button variant="outline" onClick={() => onOpenBilling(tenant)}>
                  <DollarSign aria-hidden="true" />
                  Financeiro<span className="sr-only"> de {companyName(tenant)}</span>
                </Button>
                <TenantActions {...props} tenant={tenant} size="default" />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Cliente desde {formatDate(tenant.created_at)}</p>
            </li>
          );
        })}
      </ul>
    </>
  );
}
