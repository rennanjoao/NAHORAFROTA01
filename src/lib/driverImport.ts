import { formatDocument, isValidCPF, onlyDigits } from "@/lib/documentValidation";
import { normalizeHeader, SpreadsheetRows } from "@/lib/spreadsheet";

export type DriverImportField =
  | "name"
  | "cpf"
  | "phone"
  | "contactEmail"
  | "vehiclePlate"
  | "vehicleType"
  | "cnh"
  | "cnhCategory"
  | "fleet";

// Nomes de coluna aceitos (comparados sem acento/espaco/caixa).
const HEADER_ALIASES: Record<DriverImportField, string[]> = {
  name: ["nome", "nomecompleto", "motorista", "nomedomotorista"],
  cpf: ["cpf", "cpfdomotorista"],
  phone: ["telefone", "celular", "whatsapp", "fone", "telefonecelular"],
  contactEmail: ["email", "emaildecontato", "emailcontato"],
  vehiclePlate: ["placa", "placadoveiculo", "placaveiculo"],
  vehicleType: ["tipodeveiculo", "tipoveiculo", "veiculo", "tipo"],
  cnh: ["cnh", "numerodacnh", "numerocnh", "registrocnh"],
  cnhCategory: ["categoria", "categoriacnh", "categoriadacnh"],
  fleet: ["frota", "vinculo", "tipodemotorista", "tipomotorista", "frotapropria"],
};

export const REQUIRED_FIELDS: DriverImportField[] = ["name", "cpf", "phone"];

export const FIELD_LABELS: Record<DriverImportField, string> = {
  name: "Nome",
  cpf: "CPF",
  phone: "Telefone",
  contactEmail: "E-mail",
  vehiclePlate: "Placa",
  vehicleType: "Tipo de veículo",
  cnh: "CNH",
  cnhCategory: "Categoria CNH",
  fleet: "Frota",
};

export const DRIVER_IMPORT_TEMPLATE =
  "Nome;CPF;Telefone;E-mail;Placa;Tipo de veículo;CNH;Categoria CNH;Frota\n" +
  "Maria da Silva;529.982.247-25;(11) 98888-7777;maria@email.com;ABC1D23;Van;12345678900;D;Agregado\n";

const VEHICLE_TYPES = ["fiorino", "vuc", "toco", "truck", "carreta", "van", "moto"] as const;
const PLATE_REGEX = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface DriverImportData {
  name: string;
  cpf: string;
  phone: string;
  contactEmail: string | null;
  vehiclePlate: string;
  vehicleType: (typeof VEHICLE_TYPES)[number];
  cnh: string;
  cnhCategory: string;
  isOwnFleet: boolean;
}

export interface DriverImportRow {
  line: number;
  data: DriverImportData;
  errors: string[];
}

export interface DriverImportResult {
  rows: DriverImportRow[];
  missingColumns: DriverImportField[];
}

function normalizeVehicleType(value: string): DriverImportData["vehicleType"] | null {
  const text = normalizeHeader(value);
  if (!text) return "van";
  return VEHICLE_TYPES.find((type) => text.includes(type)) ?? null;
}

function normalizeFleet(value: string): boolean {
  const text = normalizeHeader(value);
  return ["propria", "clt", "casa", "sim", "true", "verdadeiro"].some((word) => text.includes(word));
}

function formatPhone(value: string): string {
  let digits = onlyDigits(value);
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 11) return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  if (digits.length === 10) return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  return value.trim();
}

/** CPF salvo como numero no Excel perde os zeros a esquerda. */
function normalizeCpf(value: string): string {
  const digits = onlyDigits(value);
  return digits.length >= 9 && digits.length < 11 ? digits.padStart(11, "0") : digits;
}

/**
 * Converte as linhas da planilha em motoristas, apontando o erro de cada linha.
 * `existingCpfs` sao os CPFs (so digitos) ja cadastrados na empresa.
 */
export function parseDriverRows(rows: SpreadsheetRows, existingCpfs: Set<string>): DriverImportResult {
  const [header = [], ...body] = rows;
  const columns = new Map<DriverImportField, number>();
  header.forEach((title, index) => {
    const key = normalizeHeader(title);
    const field = (Object.keys(HEADER_ALIASES) as DriverImportField[]).find((f) => HEADER_ALIASES[f].includes(key));
    if (field && !columns.has(field)) columns.set(field, index);
  });

  const missingColumns = REQUIRED_FIELDS.filter((field) => !columns.has(field));
  if (missingColumns.length) return { rows: [], missingColumns };

  const get = (row: string[], field: DriverImportField) => {
    const index = columns.get(field);
    return index === undefined ? "" : (row[index] ?? "").trim();
  };

  const seenInFile = new Map<string, number>();
  const result: DriverImportRow[] = body.map((row, i) => {
    const line = i + 2;
    const errors: string[] = [];
    const cpfDigits = normalizeCpf(get(row, "cpf"));
    const plate = get(row, "vehiclePlate").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const email = get(row, "contactEmail").toLowerCase();
    const vehicleType = normalizeVehicleType(get(row, "vehicleType"));
    const name = get(row, "name").replace(/\s+/g, " ");
    const phone = formatPhone(get(row, "phone"));

    if (!name) errors.push("Nome em branco");
    if (!isValidCPF(cpfDigits)) errors.push("CPF inválido");
    else if (existingCpfs.has(cpfDigits)) errors.push("CPF já cadastrado");
    else if (seenInFile.has(cpfDigits)) errors.push(`CPF repetido (linha ${seenInFile.get(cpfDigits)})`);
    if (onlyDigits(phone).length < 10) errors.push("Telefone inválido");
    if (email && !EMAIL_REGEX.test(email)) errors.push("E-mail inválido");
    if (plate && !PLATE_REGEX.test(plate)) errors.push("Placa inválida");
    if (!vehicleType) errors.push("Tipo de veículo desconhecido");

    if (isValidCPF(cpfDigits) && !seenInFile.has(cpfDigits)) seenInFile.set(cpfDigits, line);

    return {
      line,
      errors,
      data: {
        name,
        cpf: formatDocument(cpfDigits),
        phone,
        contactEmail: email || null,
        vehiclePlate: plate || "PENDENTE",
        vehicleType: vehicleType ?? "van",
        cnh: onlyDigits(get(row, "cnh")),
        cnhCategory: get(row, "cnhCategory").toUpperCase().replace(/[^A-E]/g, "").slice(0, 2),
        isOwnFleet: normalizeFleet(get(row, "fleet")),
      },
    };
  });

  return { rows: result, missingColumns: [] };
}
