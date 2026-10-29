import { useState, useMemo, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ChevronRight, ClipboardList, Loader2, Plus, Printer, Send, Truck } from "lucide-react";
import { EmptyState, SearchInput } from "@/components/patterns";
import { DBManifest, formatManifestNumber } from "@/hooks/useManifestsDB";
import { formatCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";
import { formatDateOnly } from "@/lib/timezone";
import { ManifestStatusBadge, plateText } from "./status";

interface AddToManifestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryNfe: string;
  invoiceId: string; // Database UUID
  manifests: DBManifest[]; // DB manifests from parent
  /** Devolve false quando a nota nao entrou no romaneio (a janela fica aberta). */
  onConfirm: (manifestId: string, action: "print" | "resend" | "none") => Promise<boolean | void> | boolean | void;
}

export function AddToManifestDialog({
  open,
  onOpenChange,
  deliveryNfe,
  invoiceId,
  manifests,
  onConfirm,
}: AddToManifestDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedManifest, setSelectedManifest] = useState<DBManifest | null>(null);
  const [step, setStep] = useState<"select" | "action">("select");
  const [pendingAction, setPendingAction] = useState<"print" | "resend" | "none" | null>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  // "Continuar" some na segunda etapa: o foco vai para a primeira opcao.
  // Ao voltar, o foco fica no romaneio que estava marcado.
  useEffect(() => {
    if (!open) return;
    if (step === "action") firstActionRef.current?.focus({ preventScroll: true });
    else if (selectedManifest) document.getElementById(`add-manifest-${selectedManifest.id}`)?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  // Filter manifests - only show ACTIVE ones (pending or in_progress)
  // Sorted by most recent first (created_at descending)
  const availableManifests = useMemo(() => {
    // Filter only active manifests
    const activeStatuses = ["pending", "in_progress"];
    
    return manifests
      .filter((m) => {
        // Only allow pending or in_progress status
        if (!activeStatuses.includes(m.status)) return false;

        // Apply search filter
        if (search) {
          const searchLower = search.toLowerCase();
          return (
            m.manifest_code.toLowerCase().includes(searchLower) ||
            m.driver_name.toLowerCase().includes(searchLower) ||
            (m.vehicle_plate?.toLowerCase().includes(searchLower) ?? false)
          );
        }

        return true;
      })
      // Sort by most recent first
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50); // Limit to 50 most recent
  }, [manifests, search]);

  const handleSelect = (manifest: DBManifest) => {
    setSelectedManifest(manifest);
  };

  const handleContinue = () => {
    if (selectedManifest) {
      setStep("action");
    }
  };

  // Espera o banco confirmar: se der erro, a janela fica aberta para tentar de novo.
  const handleAction = async (action: "print" | "resend" | "none") => {
    if (!selectedManifest || pendingAction) return;
    setPendingAction(action);
    try {
      const result = await onConfirm(selectedManifest.id, action);
      if (result !== false) resetAndClose();
    } finally {
      setPendingAction(null);
    }
  };

  const handleClose = () => {
    if (pendingAction) return;
    resetAndClose();
  };

  const resetAndClose = () => {
    setSearch("");
    setSelectedManifest(null);
    setStep("select");
    onOpenChange(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const actionOptions: { action: "print" | "resend" | "none"; title: string; description: string; icon: typeof Printer }[] = [
    { action: "print", title: "Reimprimir romaneio", description: "Abre a impressão já com esta nota.", icon: Printer },
    { action: "resend", title: "Reenviar para motorista", description: "A nota aparece na lista do app do motorista.", icon: Send },
    { action: "none", title: "Apenas adicionar", description: "Sem imprimir nem avisar agora.", icon: Plus },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {step === "select" ? `Adicionar a NF ${deliveryNfe} a um romaneio` : "O que fazer depois?"}
          </DialogTitle>
          <DialogDescription>
            {step === "select"
              ? "Escolha um romaneio que ainda não terminou (aguardando saída ou em rota)."
              : `A nota entra no romaneio ${selectedManifest ? formatManifestNumber(selectedManifest) : ""}. Escolha o próximo passo.`}
          </DialogDescription>
        </DialogHeader>

        {step === "select" ? (
          <>
            <SearchInput
              label="Buscar romaneio"
              placeholder="Número, motorista ou placa"
              value={search}
              onChange={setSearch}
              className="sm:max-w-none"
            />

            <div className="max-h-[min(20rem,45vh)] overflow-y-auto rounded-lg border p-2">
              {availableManifests.length === 0 ? (
                <EmptyState
                  compact
                  icon={ClipboardList}
                  title="Nenhum romaneio em aberto"
                  description="Só romaneios aguardando saída ou em rota recebem notas novas. Gere um romaneio novo na lista de notas."
                />
              ) : (
                <RadioGroup
                  value={selectedManifest?.id ?? ""}
                  onValueChange={(id) => handleSelect(availableManifests.find((m) => m.id === id) as DBManifest)}
                  aria-label="Romaneios em aberto"
                  className="gap-2"
                >
                  {availableManifests.map((manifest) => {
                    const selected = selectedManifest?.id === manifest.id;
                    const id = `add-manifest-${manifest.id}`;
                    return (
                      <Label
                        key={manifest.id}
                        htmlFor={id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal transition-colors duration-fast",
                          selected ? "border-primary bg-primary/5" : "border-transparent hover:bg-accent",
                        )}
                      >
                        <RadioGroupItem id={id} value={manifest.id} className="mt-1" />
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-data font-semibold text-foreground">Romaneio {formatManifestNumber(manifest)}</span>
                            <ManifestStatusBadge status={manifest.status} />
                          </span>
                          <span className="flex min-w-0 items-center gap-1.5 text-sm text-foreground">
                            <Truck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span className="truncate">{manifest.driver_name}</span>
                            {plateText(manifest.vehicle_plate) && (
                              <span className="shrink-0 font-data text-xs text-muted-foreground">{plateText(manifest.vehicle_plate)}</span>
                            )}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            Saída {formatDateOnly(manifest.scheduled_date)} · criado {formatDate(manifest.created_at)}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-sm">
                          <span className="block text-muted-foreground">
                            {manifest.deliveries_count === 1 ? "1 nota" : `${manifest.deliveries_count} notas`}
                          </span>
                          <span className="block font-data font-semibold text-foreground">{formatCurrency(manifest.total_value || 0)}</span>
                        </span>
                      </Label>
                    );
                  })}
                </RadioGroup>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleContinue} disabled={!selectedManifest}>
                Continuar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-2">
              {actionOptions.map((option) => {
                const Icon = option.icon;
                const busy = pendingAction === option.action;
                return (
                  <button
                    key={option.action}
                    ref={option.action === "print" ? firstActionRef : undefined}
                    type="button"
                    onClick={() => handleAction(option.action)}
                    disabled={!!pendingAction}
                    aria-busy={busy || undefined}
                    className={cn(
                      "disabled:cursor-wait disabled:opacity-70",
                      "card-interactive flex w-full items-center gap-3 rounded-lg border bg-card p-4 text-left",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                    )}
                  >
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-foreground">{option.title}</span>
                      <span className="block text-sm text-muted-foreground">{option.description}</span>
                    </span>
                    {busy ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("select")} disabled={!!pendingAction}>
                Voltar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
