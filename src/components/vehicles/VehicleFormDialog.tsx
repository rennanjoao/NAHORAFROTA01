import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/drivers/FormField";
import { invalidSelectClass } from "@/components/drivers/DriverFormParts";
import { vehicleCapacityByType, type CompanyVehicleType } from "@/stores/companyVehicleStore";
import {
  COMPANY_VEHICLE_TYPES,
  CURRENT_YEAR,
  formatCapacity,
  validateVehicleForm,
  type VehicleFormErrors,
  type VehicleFormValues,
} from "./vehicleConfig";

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "new" | "edit";
  /** Valores ao abrir (vazio no cadastro, dados do veiculo na edicao). */
  initialValues: VehicleFormValues;
  saving: boolean;
  /** Recebe os valores ja validados e o ano numerico (undefined = sem ano). */
  onSubmit: (values: VehicleFormValues, year: number | undefined) => void;
}

const FIELD_IDS: Record<keyof VehicleFormValues, string> = {
  plate: "vehicle-plate",
  brand: "vehicle-brand",
  model: "vehicle-model",
  type: "vehicle-type",
  year: "vehicle-year",
  renavam: "vehicle-renavam",
};

/** Formulario de cadastro e edicao de veiculo da empresa. */
export function VehicleFormDialog({ open, onOpenChange, mode, initialValues, saving, onSubmit }: VehicleFormDialogProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<VehicleFormErrors>({});

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setErrors({});
    }
  }, [open, initialValues]);

  const update = (patch: Partial<VehicleFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    const keys = Object.keys(patch) as (keyof VehicleFormValues)[];
    if (keys.some((key) => errors[key])) {
      setErrors((current) => {
        const next = { ...current };
        keys.forEach((key) => delete next[key]);
        return next;
      });
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const { errors: found, year } = validateVehicleForm(values);
    const firstInvalid = (Object.keys(FIELD_IDS) as (keyof VehicleFormValues)[]).find((key) => found[key]);
    if (firstInvalid) {
      setErrors(found);
      document.getElementById(FIELD_IDS[firstInvalid])?.focus();
      return;
    }
    onSubmit(values, year);
  };

  const isNew = mode === "new";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "Cadastrar veículo" : "Editar veículo"}</DialogTitle>
          <DialogDescription>
            {isNew
              ? "Veículo da empresa, usado pelos motoristas da casa (CLT)."
              : `Altere os dados do veículo ${initialValues.plate}.`}
          </DialogDescription>
        </DialogHeader>

        <form id="vehicle-form" noValidate onSubmit={handleSubmit} className="space-y-4">
          <FormField id={FIELD_IDS.plate} label="Placa" required error={errors.plate} hint="Placa antiga (ABC1234) ou Mercosul (ABC1D23).">
            {(control) => (
              <Input
                {...control}
                placeholder="ABC1D23"
                autoComplete="off"
                maxLength={7}
                className="font-data uppercase tracking-wider"
                value={values.plate}
                onChange={(e) => update({ plate: e.target.value.toUpperCase() })}
              />
            )}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id={FIELD_IDS.brand} label="Marca" required error={errors.brand}>
              {(control) => <Input {...control} placeholder="Ex.: Volkswagen" value={values.brand} onChange={(e) => update({ brand: e.target.value })} />}
            </FormField>
            <FormField id={FIELD_IDS.model} label="Modelo" required error={errors.model}>
              {(control) => <Input {...control} placeholder="Ex.: Delivery Express" value={values.model} onChange={(e) => update({ model: e.target.value })} />}
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              id={FIELD_IDS.type}
              label="Tipo de veículo"
              required
              error={errors.type}
              hint={values.type ? `Capacidade: ${formatCapacity(vehicleCapacityByType[values.type as CompanyVehicleType])}` : undefined}
            >
              {(control) => (
                <Select value={values.type} onValueChange={(value) => update({ type: value as CompanyVehicleType })}>
                  <SelectTrigger {...control} className={invalidSelectClass}>
                    <SelectValue placeholder="Escolha" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_VEHICLE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField id={FIELD_IDS.year} label="Ano" optional error={errors.year}>
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  inputMode="numeric"
                  placeholder={String(CURRENT_YEAR)}
                  className="font-data"
                  value={values.year}
                  onChange={(e) => update({ year: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                />
              )}
            </FormField>
          </div>
          <FormField id={FIELD_IDS.renavam} label="RENAVAM" optional hint="Está no documento do veículo (CRLV).">
            {(control) => (
              <Input
                {...control}
                inputMode="numeric"
                placeholder="Número do RENAVAM"
                className="font-data"
                value={values.renavam}
                onChange={(e) => update({ renavam: e.target.value })}
              />
            )}
          </FormField>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="vehicle-form" disabled={saving}>
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
            {saving ? "Salvando..." : isNew ? "Cadastrar veículo" : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
