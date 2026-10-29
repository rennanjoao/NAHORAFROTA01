import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  Clock, 
  Wrench, 
  FileText, 
  MapPin,
  Calendar,
  Image as ImageIcon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withFreshProofPhotos } from "@/lib/proofPhotos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

const occurrenceTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  accident: { label: "Acidente", icon: AlertTriangle, color: "text-destructive bg-destructive/10" },
  delay: { label: "Atraso", icon: Clock, color: "text-warning bg-warning/10" },
  mechanical: { label: "Problema Mecânico", icon: Wrench, color: "text-warning bg-warning/10" },
  other: { label: "Outro", icon: FileText, color: "text-info bg-info/10" },
};

export function DriverOccurrencesSheet({
  open,
  onOpenChange,
  driverId,
  driverName,
}: DriverOccurrencesSheetProps) {
  const [occurrences, setOccurrences] = useState<DriverOccurrence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (open && driverId) {
      fetchOccurrences();
    }
  }, [open, driverId]);

  const fetchOccurrences = async () => {
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
  };

  const getTypeConfig = (type: string) => {
    return occurrenceTypeConfig[type] || occurrenceTypeConfig.other;
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Ocorrências de {driverName}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="h-[calc(85vh-100px)] mt-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-4">
                    <div className="flex gap-3">
                      <Skeleton className="h-12 w-12 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : occurrences.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Nenhuma Ocorrência</h3>
                <p className="text-sm text-muted-foreground">
                  Este motorista ainda não registrou ocorrências.
                </p>
              </div>
            ) : (
              <div className="space-y-4 pb-6">
                {occurrences.map((occurrence) => {
                  const config = getTypeConfig(occurrence.type);
                  const Icon = config.icon;

                  return (
                    <Card key={occurrence.id} className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${config.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <Badge variant="outline" className="mb-1">
                              {config.label}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(occurrence.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      {occurrence.description && (
                        <p className="text-sm text-foreground bg-muted/50 p-3 rounded-lg">
                          {occurrence.description}
                        </p>
                      )}

                      {/* Photo */}
                      {occurrence.photo_url && (
                        <div 
                          className="relative cursor-pointer group"
                          onClick={() => setSelectedImage(occurrence.photo_url)}
                        >
                          <img
                            src={occurrence.photo_url}
                            alt="Foto da ocorrência"
                            className="w-full h-48 object-cover rounded-lg border"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      )}

                      {/* Location */}
                      {occurrence.latitude && occurrence.longitude && (
                        <a
                          href={`https://www.google.com/maps?q=${occurrence.latitude},${occurrence.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-primary hover:underline"
                        >
                          <MapPin className="h-3 w-3" />
                          Ver localização no mapa
                        </a>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Full-screen image viewer */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Foto ampliada"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          <button
            className="absolute top-4 right-4 text-white text-xl font-bold p-2"
            onClick={() => setSelectedImage(null)}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
