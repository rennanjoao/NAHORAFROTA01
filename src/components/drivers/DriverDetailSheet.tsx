import { useEffect, useState, type ReactNode } from "react";
import { Download, Eye, FileText, KeyRound, Lock, MapPin, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog, EmptyState, StatusBadge, toneText } from "@/components/patterns";
import type { Driver } from "@/contexts/LogisticsContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useDriverDocumentsAccess } from "@/hooks/useDriverDocumentsAccess";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatSLA } from "@/lib/formatSLA";
import { cn } from "@/lib/utils";
import { ACCOUNT_TYPES, DRIVER_DOCUMENT_LABELS, PENDING_PLATE, slaTone, type DriverDocumentKey } from "./driverConfig";
import { DataList, DataRow, DriverAvatar, DriverStatusBadge, IconAction, PlateTag } from "./DriverBits";
import { driverDbId, useDriverQuickActions, type DriverRecord } from "./useDriverQuickActions";
import { useReturnFocus, useReturnFocusOnClose } from "@/hooks/useReturnFocus";

interface DriverDetailSheetProps {
  driver: Driver | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditDriver?: (driver: Driver) => void;
  onDeleteDriver?: (driverId: number) => void;
  /** Chamado depois de inativar/reativar, para a lista recarregar. */
  onStatusChanged?: () => void;
}

const DRIVER_DOCUMENTS_BUCKET = "driver-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

interface DriverDocument {
  id: string;
  document_type: DriverDocumentKey;
  file_name: string;
  file_path: string;
  created_at: string;
  url?: string;
}

function SheetSection({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function MiniStat({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 font-data text-xl font-semibold leading-tight text-foreground">{children}</div>
      {hint && <div className="mt-2">{hint}</div>}
    </div>
  );
}

export function DriverDetailSheet({ driver: baseDriver, open, onOpenChange, onEditDriver, onDeleteDriver, onStatusChanged }: DriverDetailSheetProps) {
  const driver = baseDriver as DriverRecord | null;
  const { roles } = useAuth();
  const { callOnWhatsApp, showOnMap } = useDriverQuickActions();
  const [tab, setTab] = useState("resumo");
  const returnFocus = useReturnFocus();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isInactivateDialogOpen, setIsInactivateDialogOpen] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const captureDeleteFocus = useReturnFocusOnClose(isDeleteDialogOpen);
  const captureInactivateFocus = useReturnFocusOnClose(isInactivateDialogOpen);
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const { canViewDocuments } = useDriverDocumentsAccess();

  // Cada motorista abre no resumo.
  const openDriverId = open && driver ? driverDbId(driver) : null;
  useEffect(() => {
    if (openDriverId) setTab("resumo");
  }, [openDriverId]);

  useEffect(() => {
    async function loadDocuments() {
      if (!open || !driver) {
        setDocuments([]);
        return;
      }

      const driverId = driverDbId(driver);
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
          }),
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
        title: "Documento indisponível",
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
  const driverSLA = driver.sla ?? null;
  const isInRoute = driver.status === "in_route";
  const isInactive = driver.status === "inactive";
  const usesCompanyVehicle = driver.isOwnFleet && (!driver.vehiclePlate || driver.vehiclePlate === PENDING_PLATE);
  const completion = driver.totalDeliveries > 0 ? (driver.successfulDeliveries / driver.totalDeliveries) * 100 : 0;
  const hasBankData = Boolean(driver.banco || driver.agencia || driver.conta || driver.chave_pix);

  const handleShowOnMap = () => {
    onOpenChange(false);
    showOnMap(driver);
  };

  // Inativar pede confirmacao; reativar e direto.
  const handleToggleStatus = async () => {
    if (!canManageDriver) return;

    // Em rota nao pode ser inativado.
    if (isInRoute) {
      toast({
        title: "Não dá para inativar agora",
        description: "O motorista está em rota. Finalize o romaneio primeiro.",
        variant: "destructive",
      });
      return;
    }

    if (!isInactive) {
      captureInactivateFocus();
      setIsInactivateDialogOpen(true);
      return;
    }

    await executeStatusToggle();
  };

  const executeStatusToggle = async () => {
    setIsTogglingStatus(true);
    try {
      const driverId = driverDbId(driver);
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
        title: isInactive ? "Motorista reativado" : "Motorista inativado",
        description: isInactive
          ? `${driver.name} está disponível para novos romaneios.`
          : `${driver.name} saiu das listas de seleção.`,
      });

      setIsInactivateDialogOpen(false);
      onStatusChanged?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error toggling driver status:", err);
      toast({
        title: "Não foi possível alterar a situação",
        description: err.message || "Tente de novo em instantes.",
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
      // Remove o motorista e tudo ligado a ele (RPC).
      const { data, error } = await supabase.rpc("delete_driver_complete", {
        p_driver_id: driverDbId(driver),
      });

      if (error) {
        console.error("RPC delete_driver_complete error:", error);
        toast({
          title: "Não foi possível excluir",
          description: error.message || "Tente de novo em instantes.",
          variant: "destructive",
        });
        return;
      }

      const result = data as { success: boolean; error?: string; message?: string };
      if (!result.success) {
        toast({
          title: "Não foi possível excluir",
          description: result.error || "Tente de novo em instantes.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Motorista excluído",
        description: `${driver.name} foi removido do sistema.`,
      });

      onDeleteDriver?.(driver.id);
      setIsDeleteDialogOpen(false);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error deleting driver:", err);
      toast({
        title: "Não foi possível excluir",
        description: err.message || "Tente de novo em instantes.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent {...returnFocus} className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 gap-4 border-b p-5 pr-5 sm:p-6 sm:pr-6">
          <div className="flex items-center gap-4 pr-9">
            <DriverAvatar photo={driver.photo} className="h-16 w-16 border-2 border-primary/25 shadow-sm" />
            <div className="min-w-0">
              <SheetTitle className="break-words text-xl">{driver.name}</SheetTitle>
              <SheetDescription asChild>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <DriverStatusBadge status={driver.status} />
                  <Badge variant="secondary">{driver.isOwnFleet ? "CLT (da casa)" : "Agregado"}</Badge>
                </div>
              </SheetDescription>
            </div>
          </div>
          {canManageDriver && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => callOnWhatsApp(driver)}>
                <MessageCircle aria-hidden="true" />
                <span className="sm:hidden">WhatsApp</span>
                <span className="hidden sm:inline">Chamar no WhatsApp</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleShowOnMap}>
                <MapPin aria-hidden="true" />
                Ver no mapa
              </Button>
            </div>
          )}
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 px-5 pt-4 sm:px-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="documentos">
                Documentos
                {documents.length > 0 && (
                  <span className="font-data text-xs text-muted-foreground">{documents.length}</span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-6">
            <TabsContent value="resumo" className="space-y-6">
              <SheetSection title="Desempenho nos últimos 6 meses">
                <div className={cn("grid gap-3", driver.isOwnFleet ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
                  <MiniStat label="No prazo (SLA)">
                    {driverSLA === null ? (
                      <span className="text-sm font-normal text-muted-foreground">Sem entregas</span>
                    ) : (
                      <span className={toneText[slaTone(driverSLA)]}>{formatSLA(driverSLA)}%</span>
                    )}
                  </MiniStat>
                  <MiniStat
                    label="Entregues"
                    hint={
                      <Progress
                        value={completion}
                        className="h-1.5"
                        aria-label={`${driver.successfulDeliveries} de ${driver.totalDeliveries} entregas concluídas`}
                      />
                    }
                  >
                    {driver.successfulDeliveries}
                    <span className="text-sm font-normal text-muted-foreground"> de {driver.totalDeliveries}</span>
                  </MiniStat>
                  {!driver.isOwnFleet && (
                    <MiniStat label="A receber">
                      <span className="text-base">{formatCurrency(driver.balance ?? 0)}</span>
                    </MiniStat>
                  )}
                </div>
              </SheetSection>

              <SheetSection title="Veículo">
                {usesCompanyVehicle ? (
                  <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                    Motorista da casa: escolhe um veículo da empresa ao começar cada rota.
                  </p>
                ) : (
                  <DataList>
                    <DataRow label="Tipo">{driver.vehicleType || "Não informado"}</DataRow>
                    <DataRow label="Placa">
                      <PlateTag plate={driver.vehiclePlate} />
                    </DataRow>
                  </DataList>
                )}
              </SheetSection>

              {canManageDriver && (
                <SheetSection title="Situação">
                  <div
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-lg border p-4",
                      isInactive ? "border-warning/30 bg-warning/5" : "bg-card",
                    )}
                  >
                    <div className="space-y-0.5">
                      <Label htmlFor="driver-active-switch" className="cursor-pointer">
                        {isInactive ? "Motorista inativo" : "Motorista ativo"}
                      </Label>
                      <p id="driver-active-hint" className="text-xs text-muted-foreground">
                        {isInRoute
                          ? "Em rota: não pode ser inativado agora."
                          : isInactive
                            ? "Não aparece na escolha de motorista dos romaneios."
                            : "Aparece na escolha de motorista dos romaneios."}
                      </p>
                    </div>
                    <Switch
                      id="driver-active-switch"
                      aria-describedby="driver-active-hint"
                      checked={!isInactive}
                      onCheckedChange={handleToggleStatus}
                      disabled={isInRoute || isTogglingStatus}
                    />
                  </div>
                </SheetSection>
              )}

              <SheetSection title="Acesso ao aplicativo">
                <DataList>
                  <DataRow label="Login do app">
                    {driver.appLogin ? (
                      <span className="inline-flex flex-col items-end gap-1">
                        <StatusBadge tone="success">Criado</StatusBadge>
                        <span className="break-all font-data text-xs font-normal text-muted-foreground">{driver.appLogin}</span>
                      </span>
                    ) : (
                      <StatusBadge tone="neutral">Não criado</StatusBadge>
                    )}
                  </DataRow>
                  <DataRow label="E-mail para avisos">
                    <span className="break-all">{driver.email || "Não informado"}</span>
                  </DataRow>
                </DataList>
                {!driver.appLogin && (
                  <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <KeyRound className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    O login do aplicativo é criado no cadastro do motorista.
                  </p>
                )}
              </SheetSection>
            </TabsContent>

            <TabsContent value="dados" className="space-y-6">
              <SheetSection title="Dados pessoais">
                <DataList>
                  <DataRow label="Nome">{driver.name}</DataRow>
                  <DataRow label="CPF" mono>
                    {driver.cpf || "Não informado"}
                  </DataRow>
                  <DataRow label="Telefone" mono>
                    {driver.phone || "Não informado"}
                  </DataRow>
                  <DataRow label="E-mail">
                    <span className="break-all">{driver.email || "Não informado"}</span>
                  </DataRow>
                  <DataRow label="CNH" mono>
                    {driver.cnh || "Não informada"}
                  </DataRow>
                  <DataRow label="Categoria da CNH">{driver.cnh_category || "Não informada"}</DataRow>
                </DataList>
              </SheetSection>

              <SheetSection title="Dados para pagamento">
                {hasBankData ? (
                  <DataList>
                    <DataRow label="Banco">{driver.banco || "Não informado"}</DataRow>
                    <DataRow label="Agência" mono>
                      {driver.agencia || "Não informada"}
                    </DataRow>
                    <DataRow label="Conta" mono>
                      {driver.conta || "Não informada"}
                    </DataRow>
                    <DataRow label="Tipo de conta">
                      {ACCOUNT_TYPES.find((type) => type.value === driver.tipo_conta)?.label || "Não informado"}
                    </DataRow>
                    <DataRow label="Chave PIX">
                      <span className="break-all">{driver.chave_pix || "Não informada"}</span>
                    </DataRow>
                  </DataList>
                ) : (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Nenhum dado de pagamento. Adicione em Editar dados, aba Pagamento.
                  </p>
                )}
              </SheetSection>
            </TabsContent>

            <TabsContent value="documentos" className="space-y-4">
              {!canViewDocuments && (
                <Alert variant="info">
                  <Lock aria-hidden="true" />
                  <AlertDescription>
                    Por segurança, só a equipe Na Hora abre os arquivos. Você vê a lista e pode enviar novos em Editar dados.
                  </AlertDescription>
                </Alert>
              )}
              {isLoadingDocuments ? (
                <div role="status" aria-label="Carregando documentos" className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : documents.length === 0 ? (
                <EmptyState
                  compact
                  icon={FileText}
                  title="Nenhum documento enviado"
                  description="Envie CNH, comprovante de endereço e documento do veículo em Editar dados."
                />
              ) : (
                <ul className="divide-y rounded-lg border bg-card">
                  {documents.map((document) => {
                    const label = DRIVER_DOCUMENT_LABELS[document.document_type] || document.document_type;
                    return (
                      <li key={document.id} className="flex items-center gap-3 px-4 py-3">
                        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{label}</p>
                          <p className="truncate text-xs text-muted-foreground" title={document.file_name}>
                            {document.file_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Enviado em {new Date(document.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        {canViewDocuments ? (
                          <div className="flex shrink-0 items-center gap-1">
                            <IconAction icon={Eye} label={`Abrir ${label}`} onClick={() => openDocument(document)} />
                            <IconAction icon={Download} label={`Baixar ${label}`} onClick={() => downloadDocument(document)} />
                          </div>
                        ) : (
                          <Badge variant="outline" className="shrink-0 text-muted-foreground">
                            <Lock aria-hidden="true" />
                            Restrito
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-popover px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          {canManageDriver ? (
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                captureDeleteFocus();
                setIsDeleteDialogOpen(true);
              }}
            >
              <Trash2 aria-hidden="true" />
              Excluir
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => onEditDriver?.(driver)}>
            <Pencil aria-hidden="true" />
            Editar dados
          </Button>
        </div>
      </SheetContent>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        tone="danger"
        title={`Excluir ${driver.name}?`}
        description="O motorista e os dados ligados a ele saem do sistema. Não dá para desfazer."
        confirmLabel={isDeleting ? "Excluindo..." : "Excluir motorista"}
        loading={isDeleting}
        onConfirm={handleDeleteDriver}
      />

      <ConfirmDialog
        open={isInactivateDialogOpen}
        onOpenChange={setIsInactivateDialogOpen}
        title={`Inativar ${driver.name}?`}
        description="O motorista sai das listas de seleção dos novos romaneios. Você pode reativar quando quiser."
        confirmLabel={isTogglingStatus ? "Inativando..." : "Inativar motorista"}
        loading={isTogglingStatus}
        onConfirm={executeStatusToggle}
      />
    </Sheet>
  );
}
