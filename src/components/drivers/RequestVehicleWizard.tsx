import { useState } from "react";
import { Truck, Package, MapPin, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatCurrency";
import { useLogistics, VehicleType } from "@/contexts/LogisticsContext";

interface RequestVehicleWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "cargo" | "region" | "confirm";

const vehicleTypes = [
  { value: "fiorino", label: "Fiorino", capacity: "650 kg" },
  { value: "vuc", label: "VUC", capacity: "3.5 ton" },
  { value: "toco", label: "Toco", capacity: "6 ton" },
  { value: "truck", label: "Truck", capacity: "14 ton" },
  { value: "carreta", label: "Carreta", capacity: "25 ton" },
];

const regions = [
  { value: "grande_sp", label: "Grande SP / Até 150km" },
  { value: "nacional", label: "Nacional / Outros Estados" },
];

export function RequestVehicleWizard({ open, onOpenChange }: RequestVehicleWizardProps) {
  const { createVehicleRequest } = useLogistics();
  
  const [step, setStep] = useState<Step>("cargo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form data
  const [cargoValue, setCargoValue] = useState("");
  const [productType, setProductType] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [region, setRegion] = useState("");

  const resetForm = () => {
    setStep("cargo");
    setCargoValue("");
    setProductType("");
    setVehicleType("");
    setRegion("");
    setIsSubmitting(false);
  };

  const handleNext = () => {
    if (step === "cargo") {
      if (!cargoValue || !productType || !vehicleType) {
        toast({
          title: "Preencha todos os campos",
          description: "Valor da nota, tipo de produto e veículo são obrigatórios.",
          variant: "destructive",
        });
        return;
      }
      setStep("region");
    } else if (step === "region") {
      if (!region) {
        toast({
          title: "Selecione a região",
          description: "É necessário informar a área de atuação.",
          variant: "destructive",
        });
        return;
      }
      setStep("confirm");
    }
  };

  const handleBack = () => {
    if (step === "region") setStep("cargo");
    else if (step === "confirm") setStep("region");
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    
    // Create vehicle request in context
    const selectedVehicleType = vehicleTypes.find(v => v.value === vehicleType);
    
    setTimeout(() => {
      createVehicleRequest({
        cargoValue: parsedValue,
        productType,
        vehicleType: (selectedVehicleType?.label || "VUC") as VehicleType,
        region: region as "grande_sp" | "nacional",
        estimatedDeadline: region === "grande_sp" ? "Até 24 horas" : "24 a 72 horas",
      });
      
      setIsSubmitting(false);
      toast({
        title: "✅ Veículo Solicitado!",
        description: region === "grande_sp" 
          ? "Gerenciadora de Risco: APROVADO. Veículo disponível em até 24h."
          : "Solicitação enviada. Validação de 24h a 72h necessária para rotas nacionais.",
      });
      resetForm();
      onOpenChange(false);
    }, 1500);
  };

  const selectedVehicle = vehicleTypes.find(v => v.value === vehicleType);
  const selectedRegion = regions.find(r => r.value === region);
  const parsedValue = parseFloat(cargoValue.replace(/\D/g, '')) / 100 || 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Pedir Carro Extra
          </DialogTitle>
          <DialogDescription>
            {step === "cargo" && "Informe os dados da carga para solicitar um veículo."}
            {step === "region" && "Selecione a área de atuação do veículo."}
            {step === "confirm" && "Confirme os dados e finalize a solicitação."}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {["cargo", "region", "confirm"].map((s, idx) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full transition-colors ${
                step === s ? "bg-primary" : 
                (step === "region" && s === "cargo") || (step === "confirm" && (s === "cargo" || s === "region")) 
                  ? "bg-primary/50" 
                  : "bg-muted"
              }`} />
              {idx < 2 && <div className="w-8 h-0.5 bg-muted" />}
            </div>
          ))}
        </div>

        <div className="py-4">
          {/* Step 1: Cargo Data */}
          {step === "cargo" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cargoValue">Valor da Nota (R$)</Label>
                <Input
                  id="cargoValue"
                  placeholder="Ex: 15.000,00"
                  value={cargoValue}
                  onChange={(e) => {
                    // Format as currency
                    const value = e.target.value.replace(/\D/g, '');
                    const formatted = (parseInt(value) / 100).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    });
                    setCargoValue(value ? formatted : '');
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="productType">Tipo de Produto</Label>
                <Input
                  id="productType"
                  placeholder="Ex: Eletrônicos, Alimentos, Medicamentos..."
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Veículo</Label>
                <Select value={vehicleType} onValueChange={setVehicleType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o veículo" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {vehicleTypes.map((vt) => (
                      <SelectItem key={vt.value} value={vt.value}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{vt.label}</span>
                          <span className="text-muted-foreground text-sm">({vt.capacity})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 2: Region */}
          {step === "region" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Área de Atuação</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a região" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {regions.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dynamic Validation Message */}
              {region && (
                <Card className={`p-4 ${
                  region === "grande_sp" 
                    ? "bg-success/10 border-success/30" 
                    : "bg-warning/10 border-warning/30"
                }`}>
                  <div className="flex items-start gap-3">
                    {region === "grande_sp" ? (
                      <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                    )}
                    <div>
                      {region === "grande_sp" ? (
                        <>
                          <p className="font-medium text-success">✅ Disponibilidade Imediata</p>
                          <p className="text-sm text-success/80 mt-1">
                            Veículo ativo em até 24hrs. Aprovação automática para região metropolitana.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-warning">⚠️ Rota Longa</p>
                          <p className="text-sm text-warning/80 mt-1">
                            Validação de 24h a 72h necessária. Sujeito à análise de risco e disponibilidade.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === "confirm" && (
            <div className="space-y-4">
              <Card className="p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  Resumo da Solicitação
                </h4>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Valor da Nota</span>
                    <span className="font-medium">{formatCurrency(parsedValue)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Tipo de Produto</span>
                    <span className="font-medium truncate max-w-[200px]">{productType}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Veículo</span>
                    <span className="font-medium">
                      {selectedVehicle?.label} ({selectedVehicle?.capacity})
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Região</span>
                    <span className="font-medium">{selectedRegion?.label}</span>
                  </div>
                </div>
              </Card>

              {/* Final validation message */}
              <Card className={`p-4 ${
                region === "grande_sp" 
                  ? "bg-success/10 border-success/30" 
                  : "bg-warning/10 border-warning/30"
              }`}>
                <div className="flex items-center gap-3">
                  {region === "grande_sp" ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-warning" />
                  )}
                  <p className={`text-sm font-medium ${
                    region === "grande_sp" ? "text-success" : "text-warning"
                  }`}>
                    {region === "grande_sp" 
                      ? "Veículo disponível em até 24 horas"
                      : "Prazo de validação: 24h a 72h"
                    }
                  </p>
                </div>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter>
          {step !== "cargo" && (
            <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
              Voltar
            </Button>
          )}
          {step !== "confirm" ? (
            <Button onClick={handleNext}>
              Próximo
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Solicitando...
                </>
              ) : (
                "Solicitar Veículo"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
