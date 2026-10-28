import { useState, useEffect } from "react";
import { Package, CheckCircle2, Truck, RotateCcw, FileText, User, MapPin, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { getDayBoundsUTC, getTodayBrazil, toDateStringBrazil } from "@/lib/timezone";
import { getInvoiceEventDate } from "@/lib/reportFilters";
import { getCurrentTenantId } from "@/lib/tenant";

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
  count: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  percentage: number;
  invoices: Invoice[];
}

export function DeliveryStatus() {
  const [selectedStatus, setSelectedStatus] = useState<StatusItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusItems, setStatusItems] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch invoices from Supabase
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
        .from('invoices')
        .select('id, nfe_number, recipient_name, address_full, status, driver_id, delivered_at, updated_at, imported_at')
        .eq('tenant_id', tenantId)
        .or(`status.in.(pending,in_transit),updated_at.gte.${todayStart}`)
        .order('imported_at', { ascending: false })
        .limit(1000);

      if (data && !error) {
        const finishedToday = (inv: (typeof data)[number]) =>
          toDateStringBrazil(getInvoiceEventDate(inv)) === getTodayBrazil();
        // Group by status
        const pending = data.filter(i => i.status === 'pending');
        const inRoute = data.filter(i => i.status === 'in_transit');
        const delivered = data.filter(i => i.status === 'delivered' && finishedToday(i));
        const returned = data.filter(i => (i.status === 'returned' || i.status === 'occurrence') && finishedToday(i));
        
        const total = pending.length + inRoute.length + delivered.length + returned.length || 1;
        
        setStatusItems([
          { 
            label: "Disponíveis", 
            count: pending.length, 
            icon: Package, 
            color: "text-warning", 
            bgColor: "bg-warning/20", 
            percentage: Math.round((pending.length / total) * 100),
            invoices: pending
          },
          { 
            label: "Em Rota", 
            count: inRoute.length, 
            icon: Truck, 
            color: "text-primary", 
            bgColor: "bg-primary/20", 
            percentage: Math.round((inRoute.length / total) * 100),
            invoices: inRoute
          },
          { 
            label: "Entregues", 
            count: delivered.length, 
            icon: CheckCircle2, 
            color: "text-success", 
            bgColor: "bg-success/20", 
            percentage: Math.round((delivered.length / total) * 100),
            invoices: delivered
          },
          { 
            label: "Ocorrência/Devolução", 
            count: returned.length, 
            icon: RotateCcw, 
            color: "text-destructive", 
            bgColor: "bg-destructive/20", 
            percentage: Math.round((returned.length / total) * 100),
            invoices: returned
          },
        ]);
      }
      setLoading(false);
    };

    fetchInvoices();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(uniqueChannelName("delivery-status"))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices' },
        () => fetchInvoices()
      )
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

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-5 animate-pulse">
        <div className="h-6 w-48 bg-muted rounded mb-6" />
        <div className="h-3 bg-muted rounded-full mb-6" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold">Status das Notas Fiscais</h3>
            <p className="text-sm text-muted-foreground">{total} notas em operação hoje</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-6 h-3 flex rounded-full overflow-hidden bg-secondary">
          {statusItems.map((item, index) => (
            <HoverCard key={item.label} openDelay={100} closeDelay={50}>
              <HoverCardTrigger asChild>
                <div
                  className={cn(
                    "h-full transition-all duration-500 cursor-pointer hover:opacity-80",
                    index === 0 && "rounded-l-full",
                    index === statusItems.length - 1 && "rounded-r-full",
                    item.color.replace("text-", "bg-")
                  )}
                  style={{ width: `${item.percentage}%` }}
                  onClick={() => handleStatusClick(item)}
                />
              </HoverCardTrigger>
              <HoverCardContent className="w-80" side="top">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={cn("rounded-lg p-2", item.bgColor)}>
                      <item.icon className={cn("h-4 w-4", item.color)} />
                    </div>
                    <div>
                      <p className="font-semibold">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.count} notas ({item.percentage}%)</p>
                    </div>
                  </div>
                  <p className="text-xs text-primary">Clique para ver todos →</p>
                </div>
              </HoverCardContent>
            </HoverCard>
          ))}
        </div>

        {/* Status grid - 4 columns */}
        <div className="grid grid-cols-4 gap-3">
          {statusItems.map((item) => (
            <div
              key={item.label}
              onClick={() => handleStatusClick(item)}
              className="rounded-lg bg-secondary/50 p-3 text-center transition-colors hover:bg-secondary cursor-pointer"
            >
              <div className={cn("mx-auto mb-2 w-fit rounded-lg p-2", item.bgColor)}>
                <item.icon className={cn("h-5 w-5", item.color)} />
              </div>
              <p className="text-2xl font-bold">{item.count}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Status Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedStatus && (
                <>
                  <div className={cn("rounded-lg p-2", selectedStatus.bgColor)}>
                    <selectedStatus.icon className={cn("h-5 w-5", selectedStatus.color)} />
                  </div>
                  {selectedStatus.label}
                  <Badge variant="outline" className="ml-2">
                    {selectedStatus.count} notas
                  </Badge>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {selectedStatus && selectedStatus.invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma nota neste status
                </p>
              ) : (
                selectedStatus && selectedStatus.invoices.map((invoice) => (
                  <div key={invoice.id} className="p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{invoice.nfe_number || "Sem número"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <User className="h-3 w-3" />
                      <span>{invoice.recipient_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <MapPin className="h-3 w-3" />
                      <span>{invoice.address_full}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
