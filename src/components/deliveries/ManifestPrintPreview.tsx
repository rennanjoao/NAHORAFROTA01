import { useRef, useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCNPJ } from "@/lib/cnpjValidation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { ManifestRecord } from "@/stores/manifestStore";
import { DBManifest, formatManifestNumber } from "@/hooks/useManifestsDB";
import { formatCurrency } from "@/lib/formatCurrency";
import { useTenantData } from "@/hooks/useTenantData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { plateText, vehicleTypeLabel } from "./status";
import nhfLogo from "@/assets/brand/nhf-logo-horizontal-cor-fundo-claro.svg";
import nhfLogoLine from "@/assets/brand/nhf-logo-linha-cor-fundo-claro.svg";

/** Imagem como data URL: a janela de impressao nao espera imagem remota carregar. */
async function toDataUrl(url: string): Promise<string> {
  const blob = await fetch(url).then((response) => {
    if (!response.ok) throw new Error(String(response.status));
    return response.blob();
  });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** A razao social e o proprio nome da marca (conta de teste): o logo ja diz isso. */
const isBrandName = (name?: string | null) => (name || "").toLowerCase().replace(/[^a-z]/g, "") === "nahorafrota";

interface DeliveryItem {
  id: number | string;
  nfe: string;
  recipient: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
  weight: string;
  value: string;
  observation?: string;
}

interface ManifestPrintPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manifest: ManifestRecord | null;
  deliveries: DeliveryItem[];
  // New props for DB-based manifest
  dbManifest?: DBManifest | null;
  /** Onde o foco fica ao fechar se o botao que abriu sumiu (ex.: janela de sucesso). */
  focusFallback?: () => HTMLElement | null;
}

const freightTypeLabels: Record<string, string> = {
  fixed: "Frete fixo",
  lumpsum: "Frete fechado",
  per_km: "Frete por km",
};

// Parse weight string to number (e.g., "5.2kg" -> 5.2)
const parseWeight = (weight: string): number => {
  return parseFloat(weight.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
};

// Parse value string to number (e.g., "R$ 1.350,00" -> 1350). Tira todos os pontos de milhar
// (antes so o primeiro: "R$ 1.234.567,89" virava 1234,56).
const parseValue = (value: string): number => {
  return parseFloat(value.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
};

export function ManifestPrintPreview({ 
  open, 
  onOpenChange, 
  manifest,
  deliveries: propDeliveries,
  dbManifest,
  focusFallback,
}: ManifestPrintPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  // Dados da empresa vem do banco (o store local ficava vazio ou com outra empresa).
  const { tenant } = useTenantData();
  const company = tenant
    ? {
        razaoSocial: tenant.razao_social,
        cnpj: tenant.cnpj,
        logradouro: tenant.logradouro,
        numero: tenant.numero,
        bairro: tenant.bairro,
        cidade: tenant.cidade,
        uf: tenant.uf,
        telefone: tenant.telefone,
      }
    : null;
  // Logo da empresa (Configuracoes > Dados da empresa); sem ele, o logo do Na Hora Frota.
  const clientLogoUrl = tenant?.logo_url ?? null;
  const [clientLogo, setClientLogo] = useState<string | null>(null);
  useEffect(() => {
    if (!open || !clientLogoUrl) {
      setClientLogo(null);
      return;
    }
    let cancelled = false;
    toDataUrl(clientLogoUrl)
      .then((data) => !cancelled && setClientLogo(data))
      .catch(() => !cancelled && setClientLogo(clientLogoUrl));
    return () => {
      cancelled = true;
    };
  }, [open, clientLogoUrl]);
  const [dbDeliveries, setDbDeliveries] = useState<DeliveryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch deliveries from database when dbManifest is provided
  useEffect(() => {
    const fetchInvoices = async () => {
      if (!dbManifest?.id) return;
      
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('invoices')
          .select('*')
          .eq('manifest_id', dbManifest.id);
        
        if (error) throw error;
        
        // Ordem das paradas da roteirizacao (route_sequence), depois numero da NF.
        const ordered = [...(data || [])].sort((a, b) =>
          (a.route_sequence ?? Number.MAX_SAFE_INTEGER) - (b.route_sequence ?? Number.MAX_SAFE_INTEGER) ||
          String(a.nfe_number || '').localeCompare(String(b.nfe_number || ''), 'pt-BR', { numeric: true }),
        );
        const items: DeliveryItem[] = ordered.map(inv => {
          // Format phone for print display
          const rawPhone = inv.recipient_phone?.replace(/\D/g, '') || '';
          const hasPhone = rawPhone.length >= 10;
          const formattedPhone = hasPhone
            ? rawPhone.length === 11
              ? `(${rawPhone.slice(0, 2)}) ${rawPhone.slice(2, 7)}-${rawPhone.slice(7)}`
              : `(${rawPhone.slice(0, 2)}) ${rawPhone.slice(2, 6)}-${rawPhone.slice(6)}`
            : undefined;

          return {
            id: inv.id,
            nfe: inv.nfe_number || inv.access_key?.slice(-8) || '-',
            recipient: inv.recipient_name,
            address: inv.address_street
              ? [inv.address_street, inv.address_number].filter(Boolean).join(', ')
              : inv.address_full?.split(' - ')[0] || '',
            city: inv.address_city || '',
            state: inv.address_state || '',
            zipCode: inv.address_zip || '',
            phone: formattedPhone,
            weight: inv.total_weight ? `${inv.total_weight.toFixed(2).replace(".", ",")} kg` : '-',
            value: formatCurrency(inv.total_value || 0),
            observation: inv.observation || undefined,
          };
        });
        
        setDbDeliveries(items);
      } catch (err) {
        console.error('Error fetching invoices for print:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (open && dbManifest?.id) {
      fetchInvoices();
    }
  }, [open, dbManifest?.id]);

  // Use DB deliveries if available, otherwise use prop deliveries
  const deliveries = dbManifest?.id ? dbDeliveries : propDeliveries;

  // Determine which manifest data to use
  const manifestData = dbManifest ? {
    id: dbManifest.manifest_code,
    displayNumber: formatManifestNumber(dbManifest),
    driverName: dbManifest.driver_name,
    driverCpf: dbManifest.driver_cpf || '',
    vehicleType: dbManifest.vehicle_type || '',
    driverPlate: dbManifest.vehicle_plate || '',
    freightType: dbManifest.freight_type as 'fixed' | 'lumpsum' | 'per_km',
    isOwnVehicle: dbManifest.is_own_fleet,
    estimatedDistance: dbManifest.estimated_distance,
    calculatedTotal: dbManifest.freight_value,
    createdAt: new Date(dbManifest.created_at),
  } : manifest ? {
    id: manifest.id,
    displayNumber: manifest.id,
    driverName: manifest.driverName,
    driverCpf: manifest.driverCpf,
    vehicleType: manifest.vehicleType,
    driverPlate: manifest.driverPlate,
    freightType: manifest.freightType,
    isOwnVehicle: manifest.isOwnVehicle,
    estimatedDistance: manifest.estimatedDistance,
    calculatedTotal: manifest.calculatedTotal,
    createdAt: manifest.createdAt,
  } : null;

  if (!manifestData) return null;

  const totalWeight = deliveries.reduce((sum, d) => sum + parseWeight(d.weight), 0);
  const totalValue = deliveries.reduce((sum, d) => sum + parseValue(d.value), 0);
  const deliveriesWithObs = deliveries.filter(d => d.observation);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: "O navegador bloqueou a impressão",
        description: "Permita janelas (pop-ups) para este site e toque em Imprimir de novo.",
        variant: "destructive",
      });
      return;
    }

    // Landscape orientation print styles
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Romaneio nº ${manifestData.displayNumber}</title>
          <style>
            @page { size: landscape; margin: 10mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Inter, Arial, sans-serif; padding: 15px; color: #1a1a1a; font-size: 11px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; border-bottom: 2px solid #080808; padding-bottom: 10px; }
            .brand { display: flex; align-items: flex-start; gap: 14px; }
            .brand-logo { height: 46px; max-width: 220px; object-fit: contain; object-position: left center; }
            .logo { font-size: 13px; font-weight: bold; color: #080808; }
            .logo-sub { font-size: 10px; color: #666; }
            .manifest-info { text-align: right; }
            .manifest-id { font-size: 16px; font-weight: bold; color: #0B6B4F; font-variant-numeric: tabular-nums; }
            .manifest-date { font-size: 10px; color: #666; }
            .section { margin-bottom: 12px; }
            .section-title { font-size: 11px; font-weight: bold; margin-bottom: 6px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
            .driver-info { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
            .info-item { font-size: 10px; }
            .info-label { color: #666; }
            .info-value { font-weight: 600; }
            table { width: 100%; border-collapse: collapse; font-size: 9px; }
            th { background: #f5f5f5; text-align: left; padding: 4px 6px; border: 1px solid #ddd; font-weight: 600; white-space: nowrap; }
            td { padding: 4px 6px; border: 1px solid #ddd; vertical-align: top; }
            .text-right { text-align: right; }
            .obs-cell { font-size: 8px; color: #666; font-style: italic; max-width: 150px; }
            .footer { margin-top: 15px; display: flex; justify-content: space-between; align-items: flex-start; }
            .totals { background: #f9f9f9; padding: 10px; border-radius: 4px; min-width: 200px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 10px; }
            .total-label { color: #666; }
            .total-value { font-weight: bold; }
            .signature { text-align: center; }
            .signature-line { border-top: 1px solid #333; width: 200px; margin: 0 auto; padding-top: 5px; font-size: 10px; color: #666; }
            .freight-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 10px; }
            .freight-chip { display: inline-block; border: 1px solid #ccc; border-radius: 999px; padding: 1px 8px; font-size: 9px; font-weight: 600; }
            .freight-badge { display: inline-block; background: #080808; color: #04E8A4; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: 600; }
            .obs-section { margin-top: 10px; padding: 8px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 4px; }
            .obs-title { font-weight: bold; font-size: 10px; color: #92400e; margin-bottom: 5px; }
            .obs-item { font-size: 9px; margin-bottom: 3px; }
            .obs-nf { font-weight: 600; color: #92400e; }
            .issued { margin-top: 18px; padding-top: 8px; border-top: 1px solid #ddd; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 9px; color: #666; }
            .issued img { height: 11px; width: auto; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          ${content.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    // Espera os logos carregarem (ate 3 s) antes de abrir a impressao.
    const images = [...printWindow.document.images].map((image) =>
      image.complete ? Promise.resolve() : new Promise<void>((done) => {
        image.onload = () => done();
        image.onerror = () => done();
      }),
    );
    void Promise.race([Promise.all(images), new Promise((done) => setTimeout(done, 3000))]).then(() => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 150);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="gap-0 p-0 pt-3 sm:max-w-5xl sm:pt-0"
        onOpenAutoFocus={() => {
          const active = document.activeElement;
          openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
        }}
        onCloseAutoFocus={(event) => {
          // Aberta pela janela de sucesso (que ja fechou): o foco vai para o botao de reserva.
          if (openerRef.current?.isConnected) return;
          const target = focusFallback?.();
          if (target?.isConnected) {
            event.preventDefault();
            target.focus({ preventScroll: true });
          }
        }}
      >
        {/* Barra de acoes */}
        <div className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-popover px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <DialogTitle>Romaneio {manifestData.displayNumber}</DialogTitle>
            <DialogDescription>Confira antes de imprimir. A folha sai deitada (paisagem); no navegador dá para salvar em PDF.</DialogDescription>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
              Fechar
            </Button>
            <Button onClick={handlePrint} disabled={isLoading} className="flex-1 sm:flex-none">
              <Printer aria-hidden="true" />
              Imprimir
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-6" role="status" aria-label="Carregando romaneio">
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          // Documento em papel: sempre claro (".light"), nos dois temas.
          <div
            role="region"
            aria-label="Documento do romaneio"
            tabIndex={0}
            className="overflow-x-auto bg-muted/40 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-6"
          >
          <div ref={printRef} className="light mx-auto min-w-[56rem] rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
            {/* Header */}
            <div className="header mb-4 flex items-start justify-between border-b-2 border-foreground pb-3">
              <div className="brand flex items-start gap-3.5">
                <img
                  src={clientLogo ?? clientLogoUrl ?? nhfLogo}
                  alt={clientLogoUrl ? `Logo de ${company?.razaoSocial || "sua empresa"}` : "Na Hora Frota"}
                  className="brand-logo h-[46px] max-w-[220px] object-contain object-left"
                />
                <div>
                {company?.razaoSocial && !(isBrandName(company.razaoSocial) && !clientLogoUrl) && (
                  <div className="logo text-sm font-bold text-foreground">{company.razaoSocial}</div>
                )}
                {company?.cnpj && (
                  <div className="logo-sub text-xs text-muted-foreground">CNPJ: {formatCNPJ(company.cnpj)}</div>
                )}
                {company?.logradouro && (
                  <div className="logo-sub text-xs text-muted-foreground mt-1">
                    {company.logradouro}, {company.numero} - {company.bairro} • {company.cidade}/{company.uf}
                    {company.telefone && ` • Tel: ${company.telefone}`}
                  </div>
                )}
                </div>
              </div>
              <div className="manifest-info text-right">
                <div className="text-xs text-muted-foreground mb-1">Romaneio nº</div>
                <div className="manifest-id font-data text-xl font-bold text-primary">{manifestData.displayNumber}</div>
                <div className="manifest-date text-xs text-muted-foreground mt-1">
                  {manifestData.createdAt.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                <div className="text-xs text-muted-foreground font-data">{manifestData.id}</div>
              </div>
            </div>

            {/* Driver & Freight Section - Compact Row */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="section">
                <div className="section-title text-xs font-bold mb-2 text-foreground border-b pb-1">
                  Motorista
                </div>
                <div className="driver-info grid grid-cols-2 gap-2 text-xs">
                  <div className="info-item">
                    <span className="info-label text-muted-foreground">Nome: </span>
                    <span className="info-value font-semibold">{manifestData.driverName}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label text-muted-foreground">CPF: </span>
                    <span className="info-value font-semibold font-data">{manifestData.driverCpf || '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label text-muted-foreground">Veículo: </span>
                    <span className="info-value font-semibold">{manifestData.vehicleType ? vehicleTypeLabel(manifestData.vehicleType) : '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label text-muted-foreground">Placa: </span>
                    <span className="info-value font-semibold font-data">{plateText(manifestData.driverPlate) || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="section">
                <div className="section-title text-xs font-bold mb-2 text-foreground border-b pb-1">
                  Frete
                </div>
                <div className="freight-row flex flex-wrap items-center gap-3">
                  {/* Frota propria nao tem tipo de frete (o banco guarda "fixed"). */}
                  {!manifestData.isOwnVehicle && (
                    <Badge variant="outline" className="freight-chip border-primary/40 bg-primary/10 text-xs text-primary">
                      {freightTypeLabels[manifestData.freightType] || manifestData.freightType}
                    </Badge>
                  )}
                  <Badge variant={manifestData.isOwnVehicle ? "default" : "outline"} className="freight-chip text-xs">
                    {manifestData.isOwnVehicle ? "Frota própria" : "Terceiro / agregado"}
                  </Badge>
                  {/* Sem "> 0" o React escrevia um "0" solto quando a rota nao tinha distancia. */}
                  {!!manifestData.estimatedDistance && manifestData.estimatedDistance > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Distância: {manifestData.estimatedDistance.toFixed(1).replace(".", ",")} km
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Deliveries Table - Compact */}
            <div className="section mb-4">
              <div className="section-title text-xs font-bold mb-2 text-foreground border-b pb-1">
                Notas fiscais ({deliveries.length})
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 text-xs">#</TableHead>
                    <TableHead className="w-28 text-xs">NF-e</TableHead>
                    <TableHead className="text-xs">Destinatário</TableHead>
                    <TableHead className="text-xs">Endereço</TableHead>
                    <TableHead className="w-24 text-xs">Telefone</TableHead>
                    <TableHead className="text-right w-16 text-xs">Peso</TableHead>
                    <TableHead className="text-right w-20 text-xs">Valor</TableHead>
                    <TableHead className="w-8 text-xs">Obs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((delivery, idx) => (
                    <TableRow key={delivery.id}>
                      <TableCell className="font-data text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell className="font-data font-medium text-xs">{delivery.nfe}</TableCell>
                      <TableCell className="max-w-[160px] text-xs">{delivery.recipient}</TableCell>
                      <TableCell className="text-xs">
                        {/* Papel: endereco inteiro, sem cortar com reticencias. */}
                        <div className="max-w-[220px]">
                          <div>{delivery.address}</div>
                          <div className="text-muted-foreground text-xs">
                            {[`${delivery.city}/${delivery.state}`, delivery.zipCode].filter(Boolean).join(" - ")}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-data text-xs whitespace-nowrap">{delivery.phone || "Não informado"}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs">{delivery.weight}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs">{delivery.value}</TableCell>
                      <TableCell className="text-center text-xs">
                        {delivery.observation ? "Obs." : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className="font-bold text-xs">Totais</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-bold text-xs">{totalWeight.toFixed(1).replace(".", ",")} kg</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-bold text-xs">{formatCurrency(totalValue)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {/* Observations Section - Only if there are observations */}
            {deliveriesWithObs.length > 0 && (
              <div className="obs-section mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3">
                <div className="obs-title mb-2 text-xs font-bold text-warning">
                  Observações das entregas
                </div>
                <div className="space-y-1">
                  {deliveriesWithObs.map((delivery) => (
                    <div key={delivery.id} className="obs-item text-xs">
                      <span className="obs-nf font-semibold text-warning">NF {delivery.nfe}:</span>{" "}
                      <span className="text-muted-foreground">{delivery.observation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer with totals and signature */}
            <div className="footer mt-4 flex justify-between items-start">
              <div className="totals bg-muted/30 p-3 rounded-lg">
                <div className="total-row flex justify-between gap-6 mb-1 text-xs">
                  <span className="total-label text-muted-foreground">Peso total:</span>
                  <span className="total-value font-bold">{totalWeight.toFixed(1).replace(".", ",")} kg</span>
                </div>
                <div className="total-row flex justify-between gap-6 mb-1 text-xs">
                  <span className="total-label text-muted-foreground">Valor das mercadorias:</span>
                  <span className="total-value font-bold">{formatCurrency(totalValue)}</span>
                </div>
                <Separator className="my-2" />
                <div className="total-row flex justify-between gap-6 text-sm">
                  <span className="total-label text-muted-foreground">Valor do frete:</span>
                  <span className="total-value font-data font-bold text-primary">
                    {manifestData.isOwnVehicle ? "Sem acerto (frota própria)" : formatCurrency(manifestData.calculatedTotal)}
                  </span>
                </div>
              </div>

              <div className="signature text-center">
                <div className="signature-line border-t border-foreground w-52 mx-auto pt-2 text-xs text-muted-foreground">
                  Assinatura do motorista
                </div>
              </div>
            </div>

            {/* Rodape: quem emitiu */}
            <div className="issued mt-6 flex items-center justify-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
              <span>Emitido com</span>
              <img src={nhfLogoLine} alt="Na Hora Frota" className="h-3 w-auto" />
              <span>• {new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
