import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  AlertTriangle,
  User,
  FileText,
  Calendar,
  MapPin,
  Image as ImageIcon,
  Clock,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withFreshProofPhotos } from "@/lib/proofPhotos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getOccurrenceLabel } from "@/hooks/useSLADB";

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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isDelivered ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <span>Comprovante de Entrega</span>
                </>
              ) : hasOccurrence ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <span>Ocorrência de Entrega</span>
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5" />
                  <span>Detalhes da Entrega</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-4 py-2 pr-4">
              {/* Invoice Info */}
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-muted-foreground">NF-e</p>
                    <p className="font-mono font-semibold">{nfeNumber || "N/A"}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      isDelivered
                        ? "bg-success/15 text-success border-success/30"
                        : hasOccurrence
                        ? "bg-warning/15 text-warning border-warning/30"
                        : "bg-warning/15 text-warning border-warning/30"
                    }
                  >
                    {isDelivered ? "Entregue" : hasOccurrence ? "Ocorrência" : "Pendente"}
                  </Badge>
                </div>
                <p className="text-sm">
                  <span className="text-muted-foreground">Destinatário: </span>
                  <span className="font-medium">{recipientName}</span>
                </p>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Delivery Proofs Section */}
                  {proofs.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Comprovantes ({proofs.length})
                      </h4>

                      {proofs.map((proof) => (
                        <div
                          key={proof.id}
                          className="border rounded-lg p-3 space-y-3 bg-success/10"
                        >
                          {/* Photo */}
                          {proof.photo_url && (
                            <button
                              onClick={() => setSelectedImage(proof.photo_url)}
                              className="w-full relative group"
                            >
                              <img
                                src={proof.photo_url}
                                alt="Comprovante de entrega"
                                className="w-full h-40 object-cover rounded-lg border"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "/placeholder.svg";
                                }}
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                <ExternalLink className="h-6 w-6 text-white" />
                              </div>
                            </button>
                          )}

                          {/* Signature */}
                          {proof.signature_url && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Assinatura:</p>
                              <img
                                src={proof.signature_url}
                                alt="Assinatura"
                                className="h-16 bg-white rounded border p-1"
                              />
                            </div>
                          )}

                          {/* Receiver Info */}
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {proof.receiver_name && (
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span>{proof.receiver_name}</span>
                              </div>
                            )}
                            {proof.receiver_document && (
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span>{proof.receiver_document}</span>
                              </div>
                            )}
                          </div>

                          {/* Timestamp and Location */}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(proof.delivered_at), "dd/MM/yyyy 'às' HH:mm", {
                                locale: ptBR,
                              })}
                            </span>
                            {proof.latitude && proof.longitude && (
                              <a
                                href={`https://www.google.com/maps?q=${proof.latitude},${proof.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-info hover:underline"
                              >
                                <MapPin className="h-3 w-3" />
                                Ver local
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Occurrences Section */}
                  {occurrences.length > 0 && (
                    <div className="space-y-3">
                      <Separator />
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        Histórico de Ocorrências ({occurrences.length})
                      </h4>

                      {occurrences.map((occ) => (
                        <div
                          key={occ.id}
                          className="border rounded-lg p-3 space-y-2 bg-warning/10 border-warning/30"
                        >
                          <div className="flex items-start justify-between">
                            <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">
                              {getOccurrenceLabel(occ.type)}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(occ.created_at), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })}
                            </span>
                          </div>

                          {occ.description && (
                            <p className="text-sm text-muted-foreground">{occ.description}</p>
                          )}

                          {occ.photo_url && (
                            <button
                              onClick={() => setSelectedImage(occ.photo_url)}
                              className="w-full relative group"
                            >
                              <img
                                src={occ.photo_url}
                                alt="Foto da ocorrência"
                                className="w-full h-40 object-cover rounded-lg border"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "/placeholder.svg";
                                }}
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                <ExternalLink className="h-6 w-6 text-white" />
                              </div>
                            </button>
                          )}

                          {occ.photo_url && (
                            <a
                              href={occ.photo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-info hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Abrir ou baixar imagem
                            </a>
                          )}

                          {false && (
                            <a
                              href="#"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs flex items-center gap-1 text-info hover:underline"
                            >
                              <MapPin className="h-3 w-3" />
                              Ver local da ocorrência
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* No Data Message */}
                  {proofs.length === 0 && occurrences.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhum comprovante ou ocorrência registrada.</p>
                    </div>
                  )}
                </>
              )}

              {/* Close Button */}
              <div className="pt-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => onOpenChange(false)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Full Image Viewer */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="sm:max-w-3xl p-2">
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Comprovante ampliado"
              className="w-full h-auto max-h-[80vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
