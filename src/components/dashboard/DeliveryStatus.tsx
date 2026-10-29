import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, ChevronRight, FileText, Package, RotateCcw, Truck, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, toneDot, toneSoftBg, toneText, type Tone } from "@/components/patterns";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { getDayBoundsUTC, getTodayBrazil, toDateStringBrazil } from "@/lib/timezone";
import { getInvoiceEventDate } from "@/lib/reportFilters";
import { getCurrentTenantId } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import { DetailDialog } from "./DetailPanel";
import { InvoiceList } from "./InvoiceList";
import { plural } from "./status";

interface Invoice {
  id: string;
  nfe_number: string | null;
  recipient_name: string;
  address_full: string;
  status: string;
  driver_id: string | null;
}

interface StatusItem {
  label: string;
  /** Frase do que a situacao significa, para a janela de detalhe. */
  hint: string;
  count: number;
  icon: LucideIcon;
  tone: Tone;
  percentage: number;
  invoices: Invoice[];
}

/** Notas do dia por situacao: barra empilhada + uma linha por situacao (abre a lista). */
export function DeliveryStatus() {
  const [selectedStatus, setSelectedStatus] = useState<StatusItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusItems, setStatusItems] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Busca as notas no Supabase
  useEffect(() => {
    const fetchInvoices = async () => {
      // NFs em operacao (pendentes/em rota) + as finalizadas hoje. Antes buscava
      // todas as NFs (com o XML) e o "Em Rota" procurava um status inexistente.
      const todayStart = getDayBoundsUTC(getTodayBrazil()).start;
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        setStatusItems([]);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("invoices")
        .select("id, nfe_number, recipient_name, address_full, status, driver_id, delivered_at, updated_at, imported_at")
        .eq("tenant_id", tenantId)
        .or(`status.in.(pending,in_transit),updated_at.gte.${todayStart}`)
        .order("imported_at", { ascending: false })
        .limit(1000);

      if (data && !error) {
        const finishedToday = (inv: (typeof data)[number]) => toDateStringBrazil(getInvoiceEventDate(inv)) === getTodayBrazil();
        // Agrupa por situacao
        const pending = data.filter((i) => i.status === "pending");
        const inRoute = data.filter((i) => i.status === "in_transit");
        const delivered = data.filter((i) => i.status === "delivered" && finishedToday(i));
        const returned = data.filter((i) => (i.status === "returned" || i.status === "occurrence") && finishedToday(i));

        const total = pending.length + inRoute.length + delivered.length + returned.length || 1;

        setStatusItems([
          {
            label: "Pendentes",
            hint: "Notas que ainda não saíram para entrega.",
            count: pending.length,
            icon: Package,
            tone: "warning",
            percentage: Math.round((pending.length / total) * 100),
            invoices: pending,
          },
          {
            label: "Em rota",
            hint: "Notas a caminho do cliente agora.",
            count: inRoute.length,
            icon: Truck,
            tone: "info",
            percentage: Math.round((inRoute.length / total) * 100),
            invoices: inRoute,
          },
          {
            label: "Entregues",
            hint: "Notas entregues hoje.",
            count: delivered.length,
            icon: CheckCircle2,
            tone: "success",
            percentage: Math.round((delivered.length / total) * 100),
            invoices: delivered,
          },
          {
            label: "Ocorrência ou devolução",
            hint: "Notas com problema na entrega hoje.",
            count: returned.length,
            icon: RotateCcw,
            tone: "danger",
            percentage: Math.round((returned.length / total) * 100),
            invoices: returned,
          },
        ]);
      }
      setLoading(false);
    };

    fetchInvoices();

    // Atualiza em tempo real
    const channel = supabase
      .channel(uniqueChannelName("delivery-status"))
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => fetchInvoices())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleStatusClick = (item: StatusItem) => {
    setSelectedStatus(item);
    setIsDialogOpen(true);
  };

  const total = statusItems.reduce((sum, item) => sum + item.count, 0);
  const barSummary = statusItems.map((item) => `${item.label}: ${item.count}`).join(", ");

  if (loading) {
    return (
      <Card className="h-full p-6" aria-busy="true">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-4 w-28" />
        <Skeleton className="mt-6 h-2.5 w-full rounded-full" />
        <div className="mt-6 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="flex h-full flex-col">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Notas de hoje</CardTitle>
          <CardDescription>{plural(total, "nota em operação", "notas em operação")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-5">
          {/* Barra empilhada: so visual, os numeros estao na lista abaixo */}
          <div
            role="img"
            aria-label={`Notas de hoje por situação. ${barSummary}`}
            className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted"
          >
            {statusItems
              .filter((item) => item.count > 0)
              .map((item) => (
                <span
                  key={item.label}
                  aria-hidden="true"
                  className={cn(
                    "h-full transition-[width] duration-slow ease-out first:rounded-l-full last:rounded-r-full",
                    toneDot[item.tone],
                  )}
                  style={{ width: `${item.percentage}%` }}
                />
              ))}
          </div>

          <ul className="-mx-2 space-y-0.5">
            {statusItems.map((item) => (
              <li key={item.label}>
                <button
                  type="button"
                  onClick={() => handleStatusClick(item)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      toneSoftBg[item.tone],
                      toneText[item.tone],
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                  </span>
                  {/* Quebra em vez de cortar ("Ocorrência ou devolução" no cartão estreito). */}
                  <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">{item.label}</span>
                  <span className="font-data text-base font-semibold text-foreground">{item.count}</span>
                  <span className="w-10 text-right font-data text-xs text-muted-foreground">{item.percentage}%</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          <Button asChild variant="outline" className="mt-auto w-full">
            <Link to="/deliveries">
              Abrir Entregas
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <DetailDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        icon={selectedStatus?.icon ?? FileText}
        tone={selectedStatus?.tone}
        title={selectedStatus ? `${selectedStatus.label} · ${plural(selectedStatus.count, "nota", "notas")}` : "Notas"}
        description={selectedStatus?.hint}
        bodyLabel={selectedStatus ? `Notas: ${selectedStatus.label}` : "Notas"}
        className="sm:max-w-lg"
      >
        {selectedStatus && selectedStatus.invoices.length === 0 ? (
          <EmptyState compact icon={FileText} title="Nenhuma nota nesta situação" />
        ) : (
          selectedStatus && (
            <InvoiceList
              items={selectedStatus.invoices.map((invoice) => ({
                id: invoice.id,
                number: `NF ${invoice.nfe_number || "sem número"}`,
                recipient: invoice.recipient_name,
                address: invoice.address_full,
              }))}
            />
          )
        )}
      </DetailDialog>
    </>
  );
}
