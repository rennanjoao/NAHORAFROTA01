import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, FileText, FileWarning, Pencil, RotateCcw, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog, EmptyState, Section, StatusBadge } from "@/components/patterns";
import { formatManifestNumber, type DBManifest } from "@/hooks/useManifestsDB";
import { formatCurrency } from "@/lib/formatCurrency";
import { freightTypeLabels, manifestStatusInfo } from "./settlementConfig";

export type ManifestTab = "pending" | "paid";

interface ManifestsPanelProps {
  manifests: DBManifest[];
  activeTab: ManifestTab;
  onTabChange: (tab: ManifestTab) => void;
  driverName: string;
  periodLabel: string;
  onEdit: (manifest: DBManifest) => void;
  onMarkPaid: (manifestId: string) => Promise<void>;
  onReverse: (manifest: DBManifest) => void;
  /** Motivo de o romaneio ainda nao poder ser pago (ex.: falta a nota aprovada). */
  paymentBlock?: (manifest: DBManifest) => string | null;
  /** "NF 1001" da nota que cobre o romaneio. */
  invoiceLabel?: (manifest: DBManifest) => string | null;
  /** Mostra o motorista em cada romaneio (acerto da transportadora). */
  showDriver?: boolean;
}

const formatDate = (value: string) => format(new Date(value), "dd/MM/yyyy", { locale: ptBR });

/** Romaneios do motorista (pendentes ou pagos) com as acoes de pagar, editar e estornar. */
export function ManifestsPanel({
  manifests,
  activeTab,
  onTabChange,
  driverName,
  periodLabel,
  onEdit,
  onMarkPaid,
  onReverse,
  paymentBlock,
  invoiceLabel,
  showDriver,
}: ManifestsPanelProps) {
  const [toPay, setToPay] = useState<DBManifest | null>(null);
  const [paying, setPaying] = useState(false);
  const total = manifests.reduce((sum, m) => sum + (m.freight_value || 0), 0);

  const confirmPayment = async () => {
    if (!toPay) return;
    const index = manifests.findIndex((manifest) => manifest.id === toPay.id);
    setPaying(true);
    await onMarkPaid(toPay.id);
    setPaying(false);
    setToPay(null);
    // O romaneio pago sai da lista: o foco vai para o vizinho (ou para a aba "Pagos").
    window.setTimeout(() => {
      const rows = [...document.querySelectorAll<HTMLElement>("[data-manifest-action]")].filter((el) => el.getClientRects().length > 0);
      (rows[Math.min(Math.max(0, index), rows.length - 1)] ?? document.querySelector<HTMLElement>('[data-romaneios-tab="paid"]'))?.focus();
    }, 50);
  };

  const status = (manifest: DBManifest) => {
    const info = manifestStatusInfo[manifest.status] ?? { label: manifest.status, tone: "neutral" as const };
    return <StatusBadge tone={info.tone}>{info.label}</StatusBadge>;
  };

  const ownFleetBadge = (
    <Badge variant="default">
      <Truck aria-hidden="true" />
      Frota própria
    </Badge>
  );

  // Acoes de cada romaneio; "full" = botoes largos no cartao do celular.
  const actions = (manifest: DBManifest, full?: boolean) => {
    const number = formatManifestNumber(manifest);
    return (
      <div className={full ? "mt-auto flex items-center gap-2" : "flex items-center justify-end gap-1.5"}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size={full ? "icon" : "icon-sm"}
              variant={full ? "outline" : "ghost"}
              aria-label={`Editar valor do romaneio ${number}`}
              data-manifest-action=""
              onClick={() => onEdit(manifest)}
            >
              <Pencil aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Editar valor</TooltipContent>
        </Tooltip>
        {activeTab === "pending" &&
          (manifest.status === "completed" && paymentBlock?.(manifest) ? (
            <span className={full ? "flex flex-1 items-center gap-1.5 text-xs font-medium text-warning" : "flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-warning"}>
              <FileWarning className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {paymentBlock(manifest)}
            </span>
          ) : manifest.status === "completed" ? (
            <Button size={full ? "default" : "sm"} variant="soft" className={full ? "flex-1" : undefined} onClick={() => setToPay(manifest)}>
              <CheckCircle2 aria-hidden="true" />
              Marcar como pago
            </Button>
          ) : (
            <span className={full ? "flex flex-1 items-center gap-1.5 text-xs text-muted-foreground" : "flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground"}>
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {full ? "O pagamento libera quando o romaneio for finalizado" : "Libera ao finalizar"}
            </span>
          ))}
        {activeTab === "paid" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size={full ? "default" : "sm"} variant="outline" className={full ? "flex-1" : undefined} onClick={() => onReverse(manifest)}>
                <RotateCcw aria-hidden="true" />
                Estornar
              </Button>
            </TooltipTrigger>
            <TooltipContent>Volta o romaneio para "a pagar"</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  };

  const emptyText = activeTab === "pending" ? "Nenhum romaneio pendente" : "Nenhum romaneio pago";

  const list =
    manifests.length === 0 ? (
      <Card>
        <EmptyState
          compact
          icon={FileText}
          title={`${emptyText} em: ${periodLabel.toLowerCase()}`}
          description={
            activeTab === "pending"
              ? "Tudo em dia com este motorista. Se esperava ver algo, escolha um período maior no topo."
              : "Os romaneios pagos aparecem aqui. Escolha um período maior no topo para ver mais."
          }
        />
      </Card>
    ) : (
      <>
        {/* Computador */}
        <Card className="hidden overflow-hidden lg:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Romaneio</TableHead>
                {/* Data e tipo de frete juntos: uma coluna a menos (cabe com texto "Maior" em 1024px). */}
                <TableHead>Data e frete</TableHead>
                <TableHead className="text-center">Entregas</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {manifests.map((manifest) => (
                <TableRow key={manifest.id}>
                  <TableCell className="font-data font-medium">
                    <span className="flex items-center gap-2">
                      {formatManifestNumber(manifest)}
                      {manifest.is_own_fleet && ownFleetBadge}
                      {invoiceLabel?.(manifest) && <Badge variant="outline">{invoiceLabel(manifest)}</Badge>}
                    </span>
                    {showDriver && <span className="block font-sans text-xs font-normal text-muted-foreground">{manifest.driver_name}</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="block whitespace-nowrap font-data text-foreground">{formatDate(manifest.created_at)}</span>
                    <span className="block text-xs">{freightTypeLabels[manifest.freight_type] || manifest.freight_type}</span>
                  </TableCell>
                  <TableCell className="text-center font-data">{manifest.deliveries_count}</TableCell>
                  <TableCell>
                    <span className="flex flex-col items-start gap-0.5">
                      {status(manifest)}
                      {manifest.status === "paid" && manifest.paid_at && (
                        <span className="text-xs text-muted-foreground">em {formatDate(manifest.paid_at)}</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-data font-semibold">{formatCurrency(manifest.freight_value || 0)}</TableCell>
                  <TableCell className="text-right">{actions(manifest)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="font-semibold">
                  Total {activeTab === "pending" ? "pendente" : "pago"}
                </TableCell>
                <TableCell className="text-right font-data text-base font-semibold">{formatCurrency(total)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </Card>

        {/* Celular e tablet */}
        <div className="space-y-3 lg:hidden">
          <ul className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2">
            {manifests.map((manifest) => (
              <li key={manifest.id}>
                <Card className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-data font-semibold text-foreground">
                        Romaneio {formatManifestNumber(manifest)}
                        {manifest.is_own_fleet && ownFleetBadge}
                        {invoiceLabel?.(manifest) && <Badge variant="outline">{invoiceLabel(manifest)}</Badge>}
                      </p>
                      {showDriver && <p className="text-xs text-muted-foreground">{manifest.driver_name}</p>}
                      <p className="text-xs text-muted-foreground">
                        {formatDate(manifest.created_at)} · {freightTypeLabels[manifest.freight_type] || manifest.freight_type} ·{" "}
                        {manifest.deliveries_count} entrega{manifest.deliveries_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    {status(manifest)}
                  </div>
                  <p className="font-data text-xl font-semibold text-foreground">{formatCurrency(manifest.freight_value || 0)}</p>
                  {actions(manifest, true)}
                </Card>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
            <span className="text-sm font-semibold">Total {activeTab === "pending" ? "pendente" : "pago"}</span>
            <span className="font-data text-base font-semibold">{formatCurrency(total)}</span>
          </div>
        </div>
      </>
    );

  return (
    <Section
      id="romaneios"
      title="Romaneios"
      description="Confira cada romaneio. Os finalizados já podem ser marcados como pagos."
    >
      <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as ManifestTab)}>
        <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
          <TabsTrigger value="pending" data-romaneios-tab="pending">
            <Clock aria-hidden="true" />
            Pendentes
          </TabsTrigger>
          <TabsTrigger value="paid" data-romaneios-tab="paid">
            <CheckCircle2 aria-hidden="true" />
            Pagos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pending">{activeTab === "pending" && list}</TabsContent>
        <TabsContent value="paid">{activeTab === "paid" && list}</TabsContent>
      </Tabs>

      <ConfirmDialog
        open={Boolean(toPay)}
        onOpenChange={(open) => !open && !paying && setToPay(null)}
        title={toPay ? `Marcar o romaneio ${formatManifestNumber(toPay)} como pago?` : "Marcar como pago?"}
        description={
          toPay
            ? `Confirme que o pagamento de ${formatCurrency(toPay.freight_value || 0)} para ${driverName} já foi feito. O motorista vê a mudança no aplicativo. Para desfazer depois, use "Estornar" com a senha de estorno.`
            : undefined
        }
        confirmLabel="Marcar como pago"
        loading={paying}
        onConfirm={confirmPayment}
      />
    </Section>
  );
}
