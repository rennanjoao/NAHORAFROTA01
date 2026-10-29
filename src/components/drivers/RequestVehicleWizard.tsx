import { useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantData } from "@/hooks/useTenantData";
import { DataList, DataRow } from "./DriverBits";
import { FormField } from "./FormField";
import { useReturnFocus } from "./useReturnFocus";

// O pedido vai por e-mail para a equipe Na Hora, que confirma disponibilidade e
// prazo pelo mesmo canal. Antes a tela mostrava "APROVADO" e nada era enviado.
const REQUEST_EMAIL = "suporte@nahorafrota.com.br";

interface RequestVehicleWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "cargo" | "region" | "confirm";

const STEPS: { id: Step; label: string; description: string }[] = [
  { id: "cargo", label: "Carga", description: "Informe os dados da carga para escolher o veículo certo." },
  { id: "region", label: "Região", description: "Escolha para onde o veículo vai rodar." },
  { id: "confirm", label: "Confirmar", description: `Confira o pedido. Ele vai por e-mail para ${REQUEST_EMAIL}.` },
];

const vehicleTypes = [
  { value: "fiorino", label: "Fiorino", capacity: "650 kg" },
  { value: "vuc", label: "VUC", capacity: "3,5 t" },
  { value: "toco", label: "Toco", capacity: "6 t" },
  { value: "truck", label: "Truck", capacity: "14 t" },
  { value: "carreta", label: "Carreta", capacity: "25 t" },
];

const regions = [
  { value: "grande_sp", label: "Grande SP", description: "Até 150 km da capital", estimate: "até 24 horas" },
  { value: "nacional", label: "Nacional", description: "Outros estados", estimate: "de 24 a 72 horas" },
];

type FieldErrors = Partial<Record<"cargoValue" | "productType" | "vehicleType" | "region", string>>;

/** Cartoes de escolha unica (radio) com titulo e linha de apoio. */
function ChoiceCards({
  name,
  value,
  onChange,
  options,
  columns,
  invalid,
  describedBy,
  labelledBy,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; description: string }[];
  columns: string;
  invalid?: boolean;
  describedBy?: string;
  labelledBy: string;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={onChange}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className={cn("grid gap-2", columns)}
    >
      {options.map((option) => {
        const id = `${name}-${option.value}`;
        const checked = option.value === value;
        return (
          <Label
            key={option.value}
            htmlFor={id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 font-normal transition-colors duration-fast hover:border-foreground/20",
              checked && "border-primary/60 bg-primary/5 ring-1 ring-primary/30 hover:border-primary/60",
              invalid && !value && "border-destructive/60",
            )}
          >
            <RadioGroupItem id={id} value={option.value} className="mt-0.5" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{option.label}</span>
              <span className="block text-xs text-muted-foreground">{option.description}</span>
            </span>
          </Label>
        );
      })}
    </RadioGroup>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs font-medium text-destructive animate-fade-in">
      {message}
    </p>
  );
}

export function RequestVehicleWizard({ open, onOpenChange }: RequestVehicleWizardProps) {
  const { profile } = useAuth();
  const { tenant } = useTenantData();

  const [step, setStep] = useState<Step>("cargo");
  const returnFocus = useReturnFocus();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const [cargoValue, setCargoValue] = useState("");
  const [productType, setProductType] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [region, setRegion] = useState("");

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const currentStep = STEPS[stepIndex];

  const clearError = (key: keyof FieldErrors) => setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));

  const resetForm = () => {
    setStep("cargo");
    setCargoValue("");
    setProductType("");
    setVehicleType("");
    setRegion("");
    setErrors({});
    setIsSubmitting(false);
  };

  const handleNext = () => {
    if (step === "cargo") {
      const found: FieldErrors = {};
      if (!cargoValue) found.cargoValue = "Informe o valor da nota.";
      if (!productType) found.productType = "Informe o tipo de produto.";
      if (!vehicleType) found.vehicleType = "Escolha o tipo de veículo.";
      if (Object.keys(found).length) {
        setErrors(found);
        const firstId = found.cargoValue ? "cargoValue" : found.productType ? "productType" : "vehicle-fiorino";
        document.getElementById(firstId)?.focus();
        return;
      }
      setStep("region");
    } else if (step === "region") {
      if (!region) {
        setErrors({ region: "Escolha a região." });
        document.getElementById("region-grande_sp")?.focus();
        return;
      }
      setStep("confirm");
    }
  };

  const handleBack = () => {
    if (step === "region") setStep("cargo");
    else if (step === "confirm") setStep("region");
  };

  const selectedVehicle = vehicleTypes.find((v) => v.value === vehicleType);
  const selectedRegion = regions.find((r) => r.value === region);
  const parsedValue = parseFloat(cargoValue.replace(/\D/g, "")) / 100 || 0;

  const handleSubmit = () => {
    const selectedRegionLabel = selectedRegion ? `${selectedRegion.label} / ${selectedRegion.description}` : region;
    const company = tenant?.razao_social || "Minha empresa";

    const body = [
      "Olá, equipe Na Hora Frota.",
      "",
      "Gostaria de solicitar um carro extra:",
      "",
      `Empresa: ${company}${tenant?.cnpj ? ` (CNPJ ${tenant.cnpj})` : ""}`,
      `Solicitante: ${profile?.name || ""}${profile?.email ? ` <${profile.email}>` : ""}`,
      `Veículo: ${selectedVehicle?.label || vehicleType} (${selectedVehicle?.capacity || "-"})`,
      `Tipo de produto: ${productType}`,
      `Valor da carga: ${formatCurrency(parsedValue)}`,
      `Região: ${selectedRegionLabel}`,
      "",
      "Aguardo a confirmação de disponibilidade e prazo.",
    ].join("\n");

    const subject = `Pedido de carro extra - ${company}`;
    window.location.href = `mailto:${REQUEST_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    toast({
      title: "Pedido pronto para envio",
      description: `Abrimos seu e-mail com o pedido para ${REQUEST_EMAIL}. Envie a mensagem; a equipe Na Hora confirma a disponibilidade e o prazo por lá.`,
    });
    resetForm();
    onOpenChange(false);
  };

  const isMetro = region === "grande_sp";

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent {...returnFocus} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pedir carro extra</DialogTitle>
          <DialogDescription>{currentStep.description}</DialogDescription>
        </DialogHeader>

        {/* Passos numerados */}
        <div className="space-y-3">
          <ol className="grid grid-cols-3 gap-2">
            {STEPS.map((s, index) => {
              const done = index < stepIndex;
              const current = index === stepIndex;
              return (
                <li key={s.id} aria-current={current ? "step" : undefined} className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-data text-xs font-semibold transition-colors duration",
                      current && "border-primary bg-primary text-primary-foreground",
                      done && "border-primary/40 bg-primary/10 text-primary",
                      !current && !done && "text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
                  </span>
                  <span className={cn("truncate text-sm", current ? "font-semibold text-foreground" : "text-muted-foreground")}>
                    <span className="sr-only">
                      Passo {index + 1}
                      {done ? ", concluído" : ""}:{" "}
                    </span>
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>
          <Progress value={((stepIndex + 1) / STEPS.length) * 100} aria-label={`Passo ${stepIndex + 1} de ${STEPS.length}`} className="h-1.5" />
        </div>

        <div key={step} className="animate-fade-in">
          {step === "cargo" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="cargoValue" label="Valor da nota" required error={errors.cargoValue}>
                  {(control) => (
                    <div className="relative">
                      <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        R$
                      </span>
                      <Input
                        {...control}
                        inputMode="numeric"
                        placeholder="15.000,00"
                        className="pl-9 font-data"
                        value={cargoValue}
                        onChange={(e) => {
                          // Formata como moeda enquanto digita.
                          const value = e.target.value.replace(/\D/g, "");
                          const formatted = (parseInt(value) / 100).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          });
                          setCargoValue(value ? formatted : "");
                          clearError("cargoValue");
                        }}
                      />
                    </div>
                  )}
                </FormField>
                <FormField id="productType" label="Tipo de produto" required error={errors.productType}>
                  {(control) => (
                    <Input
                      {...control}
                      placeholder="Ex.: eletrônicos, alimentos"
                      value={productType}
                      onChange={(e) => {
                        setProductType(e.target.value);
                        clearError("productType");
                      }}
                    />
                  )}
                </FormField>
              </div>

              <div className="space-y-1.5">
                <p id="vehicle-label" className="text-sm font-medium text-foreground">
                  Tipo de veículo
                </p>
                <ChoiceCards
                  name="vehicle"
                  labelledBy="vehicle-label"
                  describedBy={errors.vehicleType ? "vehicle-erro" : undefined}
                  invalid={Boolean(errors.vehicleType)}
                  value={vehicleType}
                  onChange={(value) => {
                    setVehicleType(value);
                    clearError("vehicleType");
                  }}
                  columns="grid-cols-2 sm:grid-cols-3"
                  options={vehicleTypes.map((v) => ({ value: v.value, label: v.label, description: `Até ${v.capacity}` }))}
                />
                <FieldError id="vehicle-erro" message={errors.vehicleType} />
              </div>
            </div>
          )}

          {step === "region" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <p id="region-label" className="text-sm font-medium text-foreground">
                  Área de atuação
                </p>
                <ChoiceCards
                  name="region"
                  labelledBy="region-label"
                  describedBy={errors.region ? "region-erro" : undefined}
                  invalid={Boolean(errors.region)}
                  value={region}
                  onChange={(value) => {
                    setRegion(value);
                    clearError("region");
                  }}
                  columns="sm:grid-cols-2"
                  options={regions.map((r) => ({ value: r.value, label: r.label, description: r.description }))}
                />
                <FieldError id="region-erro" message={errors.region} />
              </div>

              {selectedRegion && (
                <Alert variant={isMetro ? "success" : "warning"} className="animate-fade-in">
                  {isMetro ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
                  <p className="mb-1 font-semibold leading-snug text-foreground">{isMetro ? "Região metropolitana" : "Rota longa"}</p>
                  <AlertDescription>
                    {isMetro
                      ? "Prazo estimado de até 24 horas, sujeito à confirmação da equipe Na Hora."
                      : "Prazo estimado de 24 a 72 horas, sujeito à análise de risco e disponibilidade."}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {step === "confirm" && (
            <div className="space-y-4">
              <DataList>
                <DataRow label="Valor da nota" mono>
                  {formatCurrency(parsedValue)}
                </DataRow>
                <DataRow label="Tipo de produto">{productType}</DataRow>
                <DataRow label="Veículo">
                  {selectedVehicle?.label} (até {selectedVehicle?.capacity})
                </DataRow>
                <DataRow label="Região">
                  {selectedRegion?.label}, {selectedRegion?.description.toLowerCase()}
                </DataRow>
              </DataList>

              <Alert variant={isMetro ? "success" : "warning"}>
                {isMetro ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
                <AlertDescription className="text-foreground">
                  Prazo estimado: {selectedRegion?.estimate} (a confirmar pela equipe Na Hora).
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "cargo" ? (
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Cancelar
            </Button>
          ) : (
            <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
              Voltar
            </Button>
          )}
          {step !== "confirm" ? (
            <Button onClick={handleNext}>Continuar</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
              {isSubmitting ? "Enviando..." : "Enviar pedido por e-mail"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
