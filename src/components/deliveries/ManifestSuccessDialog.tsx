import { useEffect } from "react";
import { CheckCircle2, Download, MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { DBManifest } from "@/hooks/useManifestsDB";
import { formatCurrency } from "@/lib/formatCurrency";

interface ManifestSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manifest: DBManifest | null;
}

const vehicleTypeLabels: Record<string, string> = {
  truck: "Caminhão",
  van: "VUC/Van",
  moto: "Moto",
};

const freightTypeLabels: Record<string, string> = {
  fixed: "Frete Fixo",
  lumpsum: "Frete Fechado",
  per_km: "Frete por KM",
};

export function ManifestSuccessDialog({ 
  open, 
  onOpenChange, 
  manifest 
}: ManifestSuccessDialogProps) {
  // iOS Fix: Bloquear scroll do body quando dialog abre
  useEffect(() => {
    if (open) {
      const scrollY = window.scrollY;
      document.body.classList.add('dialog-open');
      document.body.style.top = `-${scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.classList.remove('dialog-open');
      document.body.style.top = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }

    return () => {
      document.body.classList.remove('dialog-open');
      document.body.style.top = '';
    };
  }, [open]);

  if (!manifest) return null;

  const handleDownloadPDF = () => {
    toast({
      title: "📄 Gerando PDF...",
      description: "O download iniciará em instantes.",
    });
    
    const createdDate = new Date(manifest.created_at);
    const content = `
ROMANEIO DE ENTREGAS
====================
Código: ${manifest.manifest_code}
Data: ${createdDate.toLocaleDateString("pt-BR")}

MOTORISTA
---------
Nome: ${manifest.driver_name}
CPF: ${manifest.driver_cpf || "-"}
Veículo: ${vehicleTypeLabels[manifest.vehicle_type || ""] || manifest.vehicle_type || "-"}
Placa: ${manifest.vehicle_plate || "-"}

FRETE
-----
Tipo: ${freightTypeLabels[manifest.freight_type] || manifest.freight_type}
Valor Frete: ${formatCurrency(manifest.freight_value)}
Valor Mercadorias: ${formatCurrency(manifest.total_value || 0)}
Entregas: ${manifest.deliveries_count}
${manifest.estimated_distance ? `Distância: ${manifest.estimated_distance.toFixed(1)} km` : ''}

---
Documento gerado automaticamente pelo Sistema Na Hora Transporte
    `;
    
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `romaneio-${manifest.manifest_code}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setTimeout(() => {
      toast({
        title: "✅ Arquivo Baixado",
        description: `Romaneio ${manifest.manifest_code} salvo com sucesso.`,
      });
    }, 500);
  };

  const handleSendWhatsApp = () => {
    const message = encodeURIComponent(
      `Olá ${manifest.driver_name}! 🚚\n\n` +
      `Seu romaneio foi gerado:\n` +
      `📋 Código: ${manifest.manifest_code}\n` +
      `📦 Entregas: ${manifest.deliveries_count}\n` +
      `💰 Frete: ${formatCurrency(manifest.freight_value)}\n\n` +
      `Boas entregas! 🎯`
    );
    
    const safeMessage = encodeURIComponent(
      `Ola ${manifest.driver_name}!\n\n` +
      `Seu romaneio foi gerado:\n` +
      `- Codigo: ${manifest.manifest_code}\n` +
      `- Entregas: ${manifest.deliveries_count}\n` +
      `- Frete: ${formatCurrency(manifest.freight_value)}\n\n` +
      `Boas entregas!`
    );

    window.open(`https://wa.me/?text=${safeMessage}`, "_blank");
    
    toast({
      title: "📱 WhatsApp Aberto",
      description: "Selecione o contato do motorista para enviar.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <DialogTitle className="text-xl">Romaneio Gerado com Sucesso!</DialogTitle>
          <DialogDescription>
            O romaneio foi criado e está pronto para ser enviado ao motorista.
          </DialogDescription>
        </DialogHeader>

        <Card className="p-4 bg-muted/30">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Código do Romaneio</span>
              <span className="font-mono font-semibold text-primary">{manifest.manifest_code}</span>
            </div>
            
            <Separator />
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Motorista</span>
              <span className="font-medium">{manifest.driver_name}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">CPF</span>
              <span className="font-mono text-sm">{manifest.driver_cpf || "-"}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Veículo</span>
              <span>
                {vehicleTypeLabels[manifest.vehicle_type || ""] || manifest.vehicle_type || "-"} • {manifest.vehicle_plate || "-"}
              </span>
            </div>
            
            <Separator />
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Tipo de Frete</span>
              <Badge variant="outline">{freightTypeLabels[manifest.freight_type] || manifest.freight_type}</Badge>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Entregas</span>
              <span className="font-medium">{manifest.deliveries_count}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Valor do Frete</span>
              <span className="font-bold text-lg text-primary">
                {formatCurrency(manifest.freight_value)}
              </span>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-3 pt-2">
          <Button 
            type="button"
            onClick={handleDownloadPDF} 
            variant="outline" 
            className="w-full gap-2"
            style={{ fontSize: '16px' }}
          >
            <Download className="h-4 w-4" />
            Baixar PDF
          </Button>
          
          <Button 
            type="button"
            onClick={handleSendWhatsApp} 
            className="w-full gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white"
            style={{ fontSize: '16px' }}
          >
            <MessageCircle className="h-4 w-4" />
            Enviar para Motorista
          </Button>
          
          <Button 
            type="button"
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="w-full"
            style={{ fontSize: '16px' }}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
