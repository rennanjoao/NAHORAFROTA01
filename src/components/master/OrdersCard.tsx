import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, Send, ShoppingBag, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PLAN_BY_ID, formatBRL } from "@/config/plans";
import { resendAccess, type OrderAdminRow } from "@/lib/checkout";

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Aguardando pagamento", className: "bg-muted text-muted-foreground" },
  paid: { label: "Pago · criando acesso", className: "bg-info/15 text-info" },
  provisioned: { label: "Acesso liberado", className: "bg-brand/15 text-brand" },
  failed: { label: "Falhou", className: "bg-destructive/15 text-destructive" },
  canceled: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
};

const EMAIL: Record<string, string> = {
  sent: "e-mail enviado",
  pending: "e-mail pendente",
  failed: "e-mail falhou",
  not_configured: "e-mail não configurado",
};

/** Pedidos do checkout (self-service). Só visível para admins da plataforma. */
export function OrdersCard() {
  const [orders, setOrders] = useState<OrderAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    // A tabela "orders" ainda não está nos tipos gerados do Supabase.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("orders")
      .select("id, created_at, status, mode, plan, amount_cents, company_name, cnpj, contact_name, email, whatsapp, access_email_status, access_sent_at, tenant_id, error")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("orders:", error);
      setOrders([]);
    } else {
      setOrders((data as OrderAdminRow[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onResend = async (o: OrderAdminRow) => {
    if (!window.confirm(`Gerar nova senha temporária e reenviar o acesso para ${o.email}?`)) return;
    setBusyId(o.id);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre de novo.");
      const r = await resendAccess(o.id, token);
      toast({
        title: r.email_status === "sent" ? "Acesso reenviado" : "Nova senha gerada",
        description: r.email_status === "sent" ? `E-mail enviado para ${o.email}.` : `E-mail ${EMAIL[r.email_status] || r.email_status}. Senha temporária: ${r.temp_password}`,
      });
      fetchOrders();
    } catch (e) {
      toast({ title: "Não foi possível reenviar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShoppingBag className="h-5 w-5 text-primary" aria-hidden="true" />
          Pedidos do site
        </CardTitle>
        <Button variant="outline" size="icon" onClick={fetchOrders} disabled={loading} aria-label="Atualizar pedidos">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Carregando" />
          </div>
        ) : orders.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhum pedido ainda. Os pedidos do checkout aparecem aqui assim que alguém escolhe um plano.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Administrador</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="whitespace-nowrap font-data text-xs">{new Date(o.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</TableCell>
                    <TableCell>
                      <p className="font-medium">{o.company_name}</p>
                      <p className="font-data text-xs text-muted-foreground">{o.cnpj}</p>
                    </TableCell>
                    <TableCell>
                      <p>{o.contact_name}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        {o.email}
                        <button type="button" onClick={() => copy(o.email, o.id)} className="rounded p-0.5 hover:text-foreground" aria-label={`Copiar e-mail ${o.email}`}>
                          {copied === o.id ? <Check className="h-3 w-3 text-brand" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </p>
                    </TableCell>
                    <TableCell>
                      <p>{PLAN_BY_ID[o.plan]?.name ?? o.plan}</p>
                      <p className="font-data text-xs text-muted-foreground">{formatBRL(o.amount_cents)} · {o.mode === "sandbox" ? "teste" : "Stripe"}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS[o.status]?.className}>{STATUS[o.status]?.label ?? o.status}</Badge>
                      {o.status === "provisioned" && <p className="mt-1 text-xs text-muted-foreground">{EMAIL[o.access_email_status] ?? o.access_email_status}</p>}
                      {o.status === "failed" && o.error && <p className="mt-1 max-w-[260px] text-xs text-destructive">{o.error}</p>}
                    </TableCell>
                    <TableCell className="text-right">
                      {o.status === "provisioned" && (
                        <Button size="sm" variant="outline" onClick={() => onResend(o)} disabled={busyId === o.id} className="gap-1">
                          {busyId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          Reenviar acesso
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
