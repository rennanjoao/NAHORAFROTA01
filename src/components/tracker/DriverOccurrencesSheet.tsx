import { useCallback, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, toneSoftBg, toneText } from "@/components/patterns";
import { Expand, History, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withFreshProofPhotos } from "@/lib/proofPhotos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { driverOccurrenceType } from "./occurrenceTypes";

interface DriverOccurrence {
  id: string;
  type: string;
  description: string | null;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

interface DriverOccurrencesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverId: string;
  driverName: string;
}

/** Problemas que o motorista ja enviou (aba Reportar > Ver o que ja reportei). */
export function DriverOccurrencesSheet({ open, onOpenChange, driverId, driverName }: DriverOccurrencesSheetProps) {
  const [occurrences, setOccurrences] = useState<DriverOccurrence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const fetchOccurrences = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("driver_occurrences")
        .select("*")
        .eq("driver_id", driverId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOccurrences(await withFreshProofPhotos((data || []) as DriverOccurrence[], ["photo_url"]));
    } catch (err) {
      console.error("Error fetching occurrences:", err);
    } finally {
      setIsLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    if (open && driverId) fetchOccurrences();
  }, [open, driverId, fetchOccurrences]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="flex h-[88dvh] flex-col gap-0 px-0 pb-0 pt-3">
          <div aria-hidden="true" className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/25" />
          <SheetHeader className="border-b px-5 pb-4">
            <SheetTitle>O que você já reportou</SheetTitle>
            <SheetDescription>Problemas enviados por {driverName}, do mais novo para o mais antigo.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
            {isLoading ? (
              <div role="status" aria-label="Carregando ocorrências" className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : occurrences.length === 0 ? (
              <EmptyState
                icon={History}
                title="Nada reportado ainda"
                description="Quando você enviar um problema pela aba Reportar, ele aparece aqui."
                compact
              />
            ) : (
              <ul className="space-y-3">
                {occurrences.map((occurrence) => {
                  const config = driverOccurrenceType(occurrence.type);
                  const Icon = config.icon;

                  return (
                    <li key={occurrence.id} className="space-y-3 rounded-xl border bg-card p-4">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", toneSoftBg[config.tone], toneText[config.tone])}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">{config.label}</p>
                          <p className="font-data text-xs text-muted-foreground">
                            {format(new Date(occurrence.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>

                      {occurrence.description && (
                        <p className="rounded-lg bg-muted/60 p-3 text-sm text-foreground">{occurrence.description}</p>
                      )}

                      {occurrence.photo_url && (
                        <button
                          type="button"
                          onClick={() => setSelectedImage(occurrence.photo_url)}
                          className="group relative block w-full overflow-hidden rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <img
                            src={occurrence.photo_url}
                            alt={`Foto da ocorrência: ${config.label}`}
                            className="h-44 w-full object-cover transition-transform duration-slow ease-out group-hover:scale-[1.02]"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                          <span className="surface-glass absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-foreground">
                            <Expand className="h-3.5 w-3.5" aria-hidden="true" />
                            Ampliar foto
                          </span>
                        </button>
                      )}

                      {occurrence.latitude && occurrence.longitude && (
                        <a
                          href={`https://www.google.com/maps?q=${occurrence.latitude},${occurrence.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
                        >
                          <MapPin className="h-4 w-4" aria-hidden="true" />
                          Ver o local no mapa
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Foto ampliada */}
      <Dialog open={Boolean(selectedImage)} onOpenChange={(next) => !next && setSelectedImage(null)}>
        <DialogContent className="sm:max-w-2xl" aria-describedby={undefined}>
          <DialogTitle>Foto da ocorrência</DialogTitle>
          {selectedImage && (
            <img src={selectedImage} alt="Foto da ocorrência ampliada" className="max-h-[70dvh] w-full rounded-lg object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
