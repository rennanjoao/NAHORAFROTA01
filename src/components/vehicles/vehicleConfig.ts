import type { Tone } from "@/components/patterns";
import type { CompanyVehicleType, VehicleStatus } from "@/stores/companyVehicleStore";

export const COMPANY_VEHICLE_TYPES: CompanyVehicleType[] = ["Fiorino", "VUC", "Toco", "Truck", "Carreta", "Van"];

export const VEHICLE_STATUS: Record<VehicleStatus, { label: string; tone: Tone }> = {
  available: { label: "Disponível", tone: "success" },
  in_use: { label: "Em uso", tone: "info" },
  maintenance: { label: "Em manutenção", tone: "warning" },
};

// Placa antiga (ABC1234) ou Mercosul (ABC1D23).
export const PLATE_REGEX = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;
export const CURRENT_YEAR = new Date().getFullYear();

export interface VehicleFormValues {
  plate: string;
  model: string;
  brand: string;
  type: CompanyVehicleType | "";
  year: string;
  renavam: string;
  /** Link da foto (ja enviada) ou vazio. */
  photoUrl: string;
}

export type VehicleFormErrors = Partial<Record<keyof VehicleFormValues, string>>;

export const emptyVehicleForm = (): VehicleFormValues => ({
  plate: "",
  model: "",
  brand: "",
  type: "",
  year: String(CURRENT_YEAR),
  renavam: "",
  photoUrl: "",
});

/** Valida o formulario. Devolve os erros por campo e o ano numerico (undefined = sem ano). */
export function validateVehicleForm(values: VehicleFormValues): { errors: VehicleFormErrors; year?: number } {
  const errors: VehicleFormErrors = {};
  if (!values.plate.trim()) errors.plate = "Informe a placa.";
  else if (!PLATE_REGEX.test(values.plate.trim().toUpperCase())) errors.plate = "Placa inválida. Use ABC1234 ou ABC1D23.";
  if (!values.brand.trim()) errors.brand = "Informe a marca.";
  if (!values.model.trim()) errors.model = "Informe o modelo.";
  if (!values.type) errors.type = "Escolha o tipo de veículo.";

  let year: number | undefined;
  if (values.year.trim()) {
    year = Number(values.year);
    if (!Number.isInteger(year) || year < 1950 || year > CURRENT_YEAR + 1) {
      errors.year = `Informe um ano entre 1950 e ${CURRENT_YEAR + 1}.`;
    }
  }
  return { errors, year };
}

/** Capacidade com virgula decimal ("1.5t" vira "1,5 t"). */
export function formatCapacity(capacity?: string | null): string {
  if (!capacity) return "Não informada";
  return capacity.replace(".", ",").replace(/(\d)(t|kg)$/i, "$1 $2");
}
