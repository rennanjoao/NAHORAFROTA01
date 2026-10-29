import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, StatusBadge } from "@/components/patterns";
import {
  AlertTriangle,
  User,
  FileText,
  Calendar,
  MapPin,
  Image as ImageIcon,
  Clock,
  ExternalLink,
  ZoomIn,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withFreshProofPhotos } from "@/lib/proofPhotos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DeliveryStatusBadge, occurrenceLabel } from "./status";

interface DeliveryProof {
  id: string;
  photo_url: string;
  signature_url: string | null;
  receiver_name: string | null;
  receiver_document: string | null;
  delivered_at: string;
  latitude: number | null;
  longitude: number | null;
}

interface DeliveryOccurrence {
  id: string;
  type: string;
  description: string | null;
  created_at: string;
  photo_url: string | null;
}

interface DeliveryProofViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  nfeNumber: string | null;
  recipientName: string;
  status: string;
}


export function DeliveryProofViewer({
  open,
  onOpenChange,
  invoiceId,
  nfeNumber,
  recipientName,
  status,
}: DeliveryProofViewerProps) {
  const [proofs, setProofs] = useState<DeliveryProof[]>([]);
  const [occurrences, setOccurrences] = useState<DeliveryOccurrence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (open && invoiceId) {
      fetchData();
    }
  }, [open, invoiceId]);

  const fetchData = async () => {
    setIsLoading(true);

    try {
      // Fetch delivery proofs
      const { data: proofsData } = await supabase
        .from("delivery_proofs")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("delivered_at", { ascending: false });

      setProofs(await withFreshProofPhotos((proofsData || []) as DeliveryProof[], ["photo_url", "signature_url"]));

      const { data: linkedDeliveries } = await supabase
        .from("deliveries")
        .select("id")
        .eq("invoice_id", invoiceId);

      const deliveryIds = (linkedDeliveries || []).map((delivery) => delivery.id);
      let occurrencesData: DeliveryOccurrence[] = [];
      const occurrenceColumns = "id, occurrence_type, description, created_at, photo_url";
      const toOccurrences = (rows: Array<{ id: string; occurrence_type: string; description: string | null; created_at: string | null; photo_url: string | null }>) =>
        rows.map((row) => ({
          id: row.id,
          type: row.occurrence_type,
          description: row.description,
          created_at: row.created_at || "",
          photo_url: row.photo_url,
        }));

      if (deliveryIds.length > 0) {
        const { data, error } = await supabase
          .from("delivery_occurrences")
          .select(occurrenceColumns)
          .in("delivery_id", deliveryIds)
          .order("created_at", { ascending: false });

        if (error) {
          console.warn("Error fetching occurrences by delivery_id:", error);
        } else {
          occurrencesData = toOccurrences(data || []);
        }
      }

      if (occurrencesData.length === 0) {
        const { data, error } = await supabase
          .from("delivery_occurrences")
          .select(occurrenceColumns)
          .eq("invoice_id", invoiceId)
          .order("created_at", { ascending: false });

        if (error) {
          console.warn("Error fetching occurrences by invoice_id:", error);
        } else {
          occurrencesData = toOccurrences(data || []);
        }
      }

      setOccurrences(await withFreshProofPhotos(occurrencesData, ["photo_url"]));
    } catch (err) {
      console.error("Error fetching delivery data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const isDelivered = status === "delivered";
  const hasOccurrence = status === "occurrence" || status === "returned";
  const title = isDelivered ? "Comprovante de entrega" : hasOccurrence ? "Ocorrência da entrega" : "Detalhes da entrega";

  const zoomButton = (url: string, alt: string) => (
    <button
      type="button"
      onClick={() => setSelectedImage(url)}
      className="group relative block w-full overflow-hidden rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
      aria-label={`Ampliar ${alt.toLowerCase()}`}
    >
      <img
        src={url}
        alt={alt}
        className="h-44 w-full object-cover transition-transform duration-slow ease-out group-hover:scale-[1.02]"
        onError={(e) => {
          (e.target as HTMLImageElement).src = "/placeholder.svg";
        }}
      />
      <span
        aria-hidden="true"
        className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-popover/90 text-foreground shadow-md"
      >
        <ZoomIn className="h-4 w-4" />
      </span>
    </button>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              NF {nfeNumber || "sem número"} · {recipientName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div>
              {/* Status real da nota (antes "Devolvida" aparecia como "Ocorrência"). */}
              <DeliveryStatusBadge status={status} />
            </div>

            {isLoading ? (
              <div className="space-y-3" role="status" aria-label="Carregando comprovante">
                <Skeleton className="h-44 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <>
                {proofs.length > 0 && (
                  <section aria-labelledby="proofs-title" className="space-y-3">
                    <h3 id="proofs-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      {proofs.length === 1 ? "Comprovante" : `Comprovantes (${proofs.length})`}
                    </h3>

                    {proofs.map((proof) => (
                      <div key={proof.id} className="space-y-3 rounded-lg border border-success/30 bg-success/5 p-3">
                        {proof.photo_url && zoomButton(proof.photo_url, "Foto do comprovante")}

                        {proof.signature_url && (
                          <div>
                            <p className="mb-1 text-xs text-muted-foreground">Assinatura</p>
                            {/* Assinatura e papel: fundo claro nos dois temas. */}
                            <img src={proof.signature_url} alt="Assinatura de quem recebeu" className="light h-16 rounded border bg-card p-1" />
                          </div>
                        )}

                        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                          {proof.receiver_name && (
                            <div className="flex items-center gap-2">
                              <dt><User className="h-4 w-4 text-muted-foreground" aria-hidden="true" /><span className="sr-only">Recebido por</span></dt>
                              <dd className="text-foreground">{proof.receiver_name}</dd>
                            </div>
                          )}
                          {proof.receiver_document && (
                            <div className="flex items-center gap-2">
                              <dt><FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" /><span className="sr-only">Documento</span></dt>
                              <dd className="font-data text-foreground">{proof.receiver_document}</dd>
                            </div>
                          )}
                        </dl>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                            {format(new Date(proof.delivered_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                          {proof.latitude && proof.longitude && (
                            <a
                              href={`https://www.google.com/maps?q=${proof.latitude},${proof.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 rounded-sm font-medium text-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                              Ver local no mapa
                              <span className="sr-only">(abre em nova aba)</span>
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </section>
                )}

                {occurrences.length > 0 && (
                  <section aria-labelledby="occurrences-title" className="space-y-3">
                    <h3 id="occurrences-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      {occurrences.length === 1 ? "Ocorrência" : `Ocorrências (${occurrences.length})`}
                    </h3>

                    {occurrences.map((occ) => (
                      <div key={occ.id} className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <StatusBadge tone="danger">{occurrenceLabel(occ.type)}</StatusBadge>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="font-data">{format(new Date(occ.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                          </span>
                        </div>

                        {occ.description && <p className="text-sm text-foreground">{occ.description}</p>}

                        {occ.photo_url && zoomButton(occ.photo_url, "Foto da ocorrência")}

                        {occ.photo_url && (
                          <a
                            href={occ.photo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            Abrir ou baixar a foto
                            <span className="sr-only">(abre em nova aba)</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </section>
                )}

                {proofs.length === 0 && occurrences.length === 0 && (
                  <EmptyState
                    compact
                    icon={FileText}
                    title="Nada registrado ainda"
                    description="O comprovante aparece aqui quando o motorista der baixa pelo app."
                    className="rounded-lg border border-dashed"
                  />
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Foto ampliada */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="p-2 sm:max-w-3xl sm:p-3">
          <DialogTitle className="sr-only">Foto ampliada</DialogTitle>
          <DialogDescription className="sr-only">Foto do comprovante em tamanho grande.</DialogDescription>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Comprovante ampliado"
              className="h-auto max-h-[80vh] w-full rounded object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
