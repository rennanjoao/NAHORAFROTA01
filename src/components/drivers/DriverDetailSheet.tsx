import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Eye, FileText, MessageCircle, MapPin, Truck, Star, TrendingUp, TrendingDown, Pencil, Trash2, Loader2, AlertTriangle, Power, PowerOff, User, Lock } from "lucide-react";
import { Driver } from "@/contexts/LogisticsContext";
import { formatSLA } from "@/lib/formatSLA";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useDriverDocumentsAccess } from "@/hooks/useDriverDocumentsAccess";
import { openWhatsApp } from "@/lib/whatsapp";

interface DriverDetailSheetProps {
  driver: Driver | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditDriver?: (driver: Driver) => void;
  onDeleteDriver?: (driverId: number) => void;
  /** Chamado depois de inativar/reativar, para a lista recarregar. */
  onStatusChanged?: () => void;
}

// Status config matching database values: active = Disponível, in_route = Em Rota, inactive = Inativo
const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Disponível", className: "bg-success/20 text-success border-success/30" },
  in_route: { label: "Em Rota", className: "bg-primary/20 text-primary border-primary/30" },
  inactive: { label: "Inativo", className: "bg-muted text-muted-foreground border-muted" },
  pending_approval: { label: "Pendente", className: "bg-warning/20 text-warning border-warning/30" },
};

const DRIVER_DOCUMENTS_BUCKET = "driver-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

type DriverDocumentType = "cnh" | "addressProof" | "vehicleDoc" | "trailerDoc";

interface DriverDocument {
  id: string;
  document_type: DriverDocumentType;
  file_name: string;
  file_path: string;
  created_at: string;
  url?: string;
}

const documentLabels: Record<DriverDocumentType, string> = {
  cnh: "CNH",
  addressProof: "Comprovante de Endereço",
  vehicleDoc: "Documento do Veículo (CRLV)",
  trailerDoc: "Documento da Carreta",
};

export function DriverDetailSheet({ driver, open, onOpenChange, onEditDriver, onDeleteDriver, onStatusChanged }: DriverDetailSheetProps) {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isInactivateDialogOpen, setIsInactivateDialogOpen] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const { canViewDocuments } = useDriverDocumentsAccess();

  useEffect(() => {
    async function loadDocuments() {
      if (!open || !driver) {
        setDocuments([]);
        return;
      }

      const driverId = (driver as any)._dbId || driver.id.toString();
      setIsLoadingDocuments(true);
      try {
        const { data, error } = await (supabase as any)
          .from("driver_documents")
          .select("id, document_type, file_name, file_path, created_at")
          .eq("driver_id", driverId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Arquivo so abre para o Super Admin; os demais veem apenas a lista.
        if (!canViewDocuments) {
          setDocuments(data || []);
          return;
        }

        const docsWithUrls = await Promise.all(
          (data || []).map(async (document: DriverDocument) => {
            const { data: signedData, error: signedError } = await supabase.storage
              .from(DRIVER_DOCUMENTS_BUCKET)
              .createSignedUrl(document.file_path, SIGNED_URL_TTL_SECONDS);

            return {
              ...document,
              url: signedError ? undefined : signedData?.signedUrl,
            };
          })
        );

        setDocuments(docsWithUrls);
      } catch (error) {
        console.error("Error loading driver documents:", error);
        setDocuments([]);
      } finally {
        setIsLoadingDocuments(false);
      }
    }

    loadDocuments();
  }, [open, driver, canViewDocuments]);

  const openDocument = (document: DriverDocument) => {
    if (!document.url) {
      toast({
        title: "Documento indisponivel",
        description: "Não foi possível gerar o link deste arquivo.",
        variant: "destructive",
      });
      return;
    }

    window.open(document.url, "_blank");
  };

  const downloadDocument = (document: DriverDocument) => {
    if (!document.url) {
      openDocument(document);
      return;
    }

    const link = window.document.createElement("a");
    link.href = document.url;
    link.download = document.file_name;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  if (!driver) return null;

  const canManageDriver = roles.includes("admin") || roles.includes("fleet_manager");
  const status = statusConfig[driver.status] || statusConfig.inactive;
  const driverSLA = driver.sla ?? null;
  const isInRoute = driver.status === "in_route";
  const isInactive = driver.status === "inactive";

  const handleWhatsApp = () => {
    if (!openWhatsApp(driver.phone)) {
      toast({ title: "Telefone inválido", description: "Cadastre o telefone do motorista com DDD.", variant: "destructive" });
    }
  };

  const handleLocateOnMap = () => {
    const driverId = (driver as any)._dbId || driver.id.toString();

    // Navigate to dashboard and pass driver ID to focus on map
    onOpenChange(false);
    navigate(`/?focusDriver=${driverId}`);
  };

  // Handle toggle status (inactivate/reactivate)
  const handleToggleStatus = async () => {
    if (!canManageDriver) return;

    // Safety check: cannot inactivate if driver is in_route
    if (isInRoute) {
      toast({
        title: "⚠️ Operação Bloqueada",
        description: "Não é possível inativar um motorista que está Em Rota. Finalize o romaneio primeiro.",
        variant: "destructive",
      });
      return;
    }

    // Show confirmation dialog for inactivation
    if (!isInactive) {
      setIsInactivateDialogOpen(true);
      return;
    }

    // Reactivate directly
    await executeStatusToggle();
  };

  const executeStatusToggle = async () => {
    setIsTogglingStatus(true);
    try {
      const driverId = (driver as any)._dbId || driver.id.toString();
      const newStatus = isInactive ? "active" : "inactive";

      const { data, error } = await supabase
        .from("drivers")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", driverId)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Você não tem permissão para esta tarefa");

      toast({
        title: isInactive ? "✅ Motorista Reativado" : "⏸️ Motorista Inativado",
        description: isInactive 
          ? `${driver.name} está disponível para novos romaneios.`
          : `${driver.name} foi removido das listas de seleção.`,
      });

      setIsInactivateDialogOpen(false);
      onStatusChanged?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error toggling driver status:", err);
      toast({
        title: "❌ Erro",
        description: err.message || "Não foi possível alterar o status.",
        variant: "destructive",
      });
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleDeleteDriver = async () => {
    if (!canManageDriver) return;

    setIsDeleting(true);
    try {
      // Use the _dbId (database UUID) if available, otherwise try driver.id
      const driverId = (driver as any)._dbId || driver.id.toString();

      // Call the RPC to delete driver completely
      const { data, error } = await supabase.rpc("delete_driver_complete", {
        p_driver_id: driverId,
      });

      if (error) {
        console.error("RPC delete_driver_complete error:", error);
        toast({
          title: "❌ Erro ao remover",
          description: error.message || "Não foi possível remover o motorista.",
          variant: "destructive",
        });
        return;
      }

      // Check RPC response
      const result = data as { success: boolean; error?: string; message?: string };
      if (!result.success) {
        toast({
          title: "❌ Erro ao remover",
          description: result.error || "Não foi possível remover o motorista.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "🗑️ Motorista Removido",
        description: `${driver.name} foi removido do sistema.`,
      });

      onDeleteDriver?.(driver.id);
      setIsDeleteDialogOpen(false);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error deleting driver:", err);
      toast({
        title: "❌ Erro ao remover",
        description: err.message || "Não foi possível remover o motorista.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left pb-4">
          {/* Header with Photo and Name */}
          <div className="flex items-center gap-4">
            <img 
              src={driver.photo} 
              alt={driver.name}
              className="h-20 w-20 rounded-full object-cover border-2 border-primary/30 shadow-lg"
            />
            <div className="flex-1">
              <SheetTitle className="text-xl font-heading">{driver.name}</SheetTitle>
              <Badge variant="outline" className={cn("mt-2", status.className)}>
                {status.label}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Action Buttons */}
          {canManageDriver && (
          <div className="grid grid-cols-2 gap-2">
            <Button 
              onClick={handleWhatsApp}
              className="bg-green-500 hover:bg-green-600 text-white gap-1 h-10 text-sm font-medium"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
            
            <Button 
              onClick={handleLocateOnMap}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1 h-10 text-sm font-medium btn-neon"
            >
              <MapPin className="h-4 w-4" />
              Localizar
            </Button>
          </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button 
              onClick={() => onEditDriver?.(driver)}
              variant="outline"
              className="gap-1 h-10 text-sm font-medium"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </Button>

            <Button 
              onClick={() => setIsDeleteDialogOpen(true)}
              variant="outline"
              className="gap-1 h-10 text-sm font-medium text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </Button>
          </div>

          {/* Status Toggle - Inativate/Reactivate */}
          {canManageDriver && (
          <div className={cn(
            "flex items-center justify-between p-3 rounded-lg border",
            isInRoute ? "bg-muted/30 border-muted" : isInactive ? "bg-warning/10 border-warning/30" : "bg-secondary/50 border-border"
          )}>
            <div className="flex items-center gap-2">
              {isInactive ? (
                <PowerOff className="h-4 w-4 text-warning" />
              ) : (
                <Power className="h-4 w-4 text-success" />
              )}
              <div>
                <Label className="text-sm font-medium">
                  {isInactive ? "Motorista Inativo" : "Motorista Ativo"}
                </Label>
                {isInRoute && (
                  <p className="text-xs text-muted-foreground">
                    Em rota - não pode ser inativado
                  </p>
                )}
              </div>
            </div>
            <Switch
              checked={!isInactive}
              onCheckedChange={handleToggleStatus}
              disabled={isInRoute || isTogglingStatus}
              className={cn(
                isInRoute && "opacity-50 cursor-not-allowed"
              )}
            />
          </div>
          )}

          <Separator />

          {/* Vehicle Information */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Truck className="h-4 w-4" />
              INFORMAÇÕES DO VEÍCULO
            </h3>
            <div className="bg-secondary/50 rounded-lg px-4 divide-y divide-border/70">
              <div className="flex items-center justify-between gap-4 py-4">
                <span className="text-muted-foreground">Placa</span>
                <span className="font-mono font-semibold text-right break-all">
                  {driver.vehiclePlate || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 py-4">
                <span className="text-muted-foreground">Modelo</span>
                <span className="font-medium text-right">{driver.vehicleType || "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-4">
                <span className="text-muted-foreground">Tipo</span>
                <Badge variant="secondary" className="shrink-0">
                  {driver.vehicleType || "-"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Performance / SLA */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Star className="h-4 w-4" />
              DESEMPENHO
            </h3>
            <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">SLA (6 meses)</span>
                {driverSLA === null ? (
                  <span className="text-sm text-muted-foreground">Sem entregas finalizadas</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-mono font-bold text-lg",
                      driverSLA >= 95 ? "text-success" :
                      driverSLA >= 85 ? "text-warning" : "text-destructive"
                    )}>
                      {formatSLA(driverSLA)}%
                    </span>
                    {driverSLA >= 95 && <TrendingUp className="h-4 w-4 text-success" />}
                    {driverSLA < 85 && <TrendingDown className="h-4 w-4 text-destructive" />}
                  </div>
                )}
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entregues / finalizadas (6 meses)</span>
                <span className="font-medium font-mono">
                  {driver.successfulDeliveries}/{driver.totalDeliveries}
                </span>
              </div>
            </div>
          </div>

          {/* Personal Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              DADOS PESSOAIS
            </h3>
            <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Nome</span>
                <span className="font-medium text-right">{driver.name}</span>
              </div>
              <Separator />
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">CPF</span>
                <span className="font-mono text-right">{driver.cpf || "-"}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Telefone</span>
                <span className="font-medium text-right">{driver.phone || "-"}</span>
              </div>
              <Separator />
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">E-mail</span>
                <span className="font-medium text-right break-all">{driver.email || "-"}</span>
              </div>
              <Separator />
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">CNH</span>
                <span className="font-mono text-right">{(driver as any).cnh || "-"}</span>
              </div>
              <Separator />
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Categoria CNH</span>
                <span className="font-medium text-right">{(driver as any).cnh_category || "-"}</span>
              </div>
            </div>
          </div>

          {/* Driver Documents */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              DOCUMENTOS
            </h3>
            <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
              {isLoadingDocuments ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando documentos...
                </div>
              ) : documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum documento enviado.</p>
              ) : (
                documents.map((document, index) => (
                  <div key={document.id}>
                    {index > 0 && <Separator className="mb-3" />}
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {documentLabels[document.document_type] || document.document_type}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {document.file_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Enviado em {new Date(document.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      {canViewDocuments ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Abrir documento"
                            onClick={() => openDocument(document)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Baixar documento"
                            onClick={() => downloadDocument(document)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="outline" className="shrink-0 gap-1 text-[10px] text-muted-foreground" title="Somente o Super Admin pode abrir os documentos do motorista">
                          <Lock className="h-3 w-3" />
                          Restrito ao Super Admin
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </SheetContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Remover Motorista
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{driver.name}</strong> do sistema?
              Esta ação não pode ser desfeita e removerá todos os dados associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteDriver}
              className="bg-destructive hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removendo...
                </>
              ) : (
                "Remover Motorista"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Inactivate Confirmation Dialog */}
      <AlertDialog open={isInactivateDialogOpen} onOpenChange={setIsInactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <PowerOff className="h-5 w-5 text-warning" />
              Inativar Motorista
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja inativar <strong>{driver.name}</strong>?
              <br /><br />
              O motorista será removido de todas as listas de seleção para novos romaneios.
              Você poderá reativá-lo a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isTogglingStatus}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={executeStatusToggle}
              className="bg-warning hover:bg-warning/90 text-warning-foreground"
              disabled={isTogglingStatus}
            >
              {isTogglingStatus ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Inativando...
                </>
              ) : (
                "Inativar Motorista"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
