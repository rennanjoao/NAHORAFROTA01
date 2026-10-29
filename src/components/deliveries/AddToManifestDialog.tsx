import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  FileText,
  Truck,
  Calendar,
  CheckCircle2,
  Printer,
  Send,
  Lock,
} from "lucide-react";
import { DBManifest, formatManifestNumber } from "@/hooks/useManifestsDB";
import { formatCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";

interface AddToManifestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryNfe: string;
  invoiceId: string; // Database UUID
  manifests: DBManifest[]; // DB manifests from parent
  onConfirm: (manifestId: string, action: "print" | "resend" | "none") => void;
}

// Status labels for display
const statusLabels: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em Rota",
  completed: "Concluído",
  paid: "Pago",
  cancelled: "Cancelado",
};

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

  const handleAction = (action: "print" | "resend" | "none") => {
    if (selectedManifest) {
      onConfirm(selectedManifest.id, action);
      handleClose();
    }
  };

  const handleClose = () => {
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {step === "select"
              ? "Adicionar NF a Romaneio Existente"
              : "Ação Após Inclusão"}
          </DialogTitle>
          <DialogDescription>
            {step === "select" ? (
              <>
                Selecione um romaneio <strong className="text-foreground">ativo</strong> para adicionar a{" "}
                <strong className="text-foreground">NF {deliveryNfe}</strong>
              </>
            ) : (
              <>
                A NF será adicionada ao Romaneio{" "}
                <strong className="text-primary">
                  nº {selectedManifest ? formatManifestNumber(selectedManifest) : ""}
                </strong>
                . O que deseja fazer em seguida?
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {step === "select" ? (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, motorista ou placa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Info about filtered results */}
            <p className="text-xs text-muted-foreground">
              Mostrando apenas romaneios com status <strong>Pendente</strong> ou <strong>Em Rota</strong> (os mais recentes primeiro)
            </p>

            {/* Manifest List */}
            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-2 space-y-2">
                {availableManifests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum romaneio ativo encontrado</p>
                    <p className="text-xs mt-1">
                      Apenas romaneios Pendentes ou Em Rota podem receber novas NFs
                    </p>
                  </div>
                ) : (
                  availableManifests.map((manifest) => (
                    <div
                      key={manifest.id}
                      onClick={() => handleSelect(manifest)}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-all",
                        selectedManifest?.id === manifest.id
                          ? "border-primary bg-primary/5 ring-2 ring-primary"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-primary">
                              Nº {formatManifestNumber(manifest)}
                            </span>
                            <Badge 
                              variant={manifest.status === "pending" ? "outline" : "default"}
                              className={cn(
                                "text-xs",
                                manifest.status === "in_progress" && "bg-primary"
                              )}
                            >
                              {statusLabels[manifest.status] || manifest.status}
                            </Badge>
                            {selectedManifest?.id === manifest.id && (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Truck className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{manifest.driver_name}</span>
                            {manifest.vehicle_plate && (
                              <span className="text-muted-foreground font-mono text-xs">
                                {manifest.vehicle_plate}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>Criado: {formatDate(manifest.created_at)}</span>
                            <span className="mx-1">•</span>
                            <span>Agendado: {new Date(manifest.scheduled_date).toLocaleDateString("pt-BR")}</span>
                          </div>
                          <div className="text-xs text-muted-foreground font-mono mt-1">
                            {manifest.manifest_code}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className="mb-1">
                            {manifest.deliveries_count} NFs
                          </Badge>
                          <div className="text-sm font-medium">
                            {formatCurrency(manifest.total_value || 0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

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
            {/* Action Selection */}
            <div className="space-y-3 py-4">
              <div className="p-4 border rounded-lg bg-muted/30">
                <div className="text-sm text-muted-foreground mb-1">
                  Romaneio selecionado
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-bold text-primary text-lg">
                      Nº {selectedManifest ? formatManifestNumber(selectedManifest) : ""}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedManifest?.driver_name} • {selectedManifest?.deliveries_count} NFs
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {selectedManifest?.manifest_code}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <Button
                  variant="outline"
                  className="h-auto py-4 justify-start gap-3"
                  onClick={() => handleAction("print")}
                >
                  <Printer className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <div className="font-medium">Reimprimir Romaneio</div>
                    <div className="text-xs text-muted-foreground">
                      Gera nova impressão com a NF adicionada
                    </div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-4 justify-start gap-3"
                  onClick={() => handleAction("resend")}
                >
                  <Send className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <div className="font-medium">Reenviar para Motorista</div>
                    <div className="text-xs text-muted-foreground">
                      Notifica o motorista sobre a atualização
                    </div>
                  </div>
                </Button>

                <Button
                  variant="ghost"
                  className="h-auto py-3 justify-start gap-3 text-muted-foreground"
                  onClick={() => handleAction("none")}
                >
                  <div className="text-left">
                    <div className="font-medium">Apenas adicionar</div>
                    <div className="text-xs">Sem reimpressão ou reenvio</div>
                  </div>
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("select")}>
                Voltar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
