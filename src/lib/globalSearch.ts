import { ClipboardList, FileText, Truck, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { vehicleTypeLabel } from "@/lib/vehicles";

/**
 * Busca geral (motoristas, veiculos, notas e romaneios) usada pela paleta de
 * comandos (Ctrl K). Cada resultado leva para a tela certa com "?q=" preenchido.
 */

export type ResultKind = "driver" | "vehicle" | "invoice" | "manifest";

export interface SearchResult {
  kind: ResultKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export const KIND_META: Record<ResultKind, { label: string; icon: typeof User }> = {
  driver: { label: "Motoristas", icon: User },
  vehicle: { label: "Veículos", icon: Truck },
  invoice: { label: "Notas fiscais", icon: FileText },
  manifest: { label: "Romaneios", icon: ClipboardList },
};

const LIMIT = 5;

/** Remove o que tem significado no filtro "or" do PostgREST (virgula, parenteses, curingas). */
export function toFilterTerm(value: string): string {
  return value.replace(/[,()*%\\:"]/g, " ").replace(/\s+/g, " ").trim();
}

export async function searchAll(term: string): Promise<SearchResult[]> {
  // Valor entre aspas: pontos e espacos do termo nao quebram o filtro.
  const like = `"%${term}%"`;
  const digits = term.replace(/\D/g, "");
  const q = encodeURIComponent;

  const driverFilter = [`name.ilike.${like}`, `vehicle_plate.ilike.${like}`];
  if (digits.length >= 3) driverFilter.push(`cpf.ilike."%${digits}%"`);

  // O RLS ja limita tudo a empresa do usuario.
  const [drivers, vehicles, invoices, manifests] = await Promise.all([
    supabase.from("drivers").select("id, name, vehicle_plate, vehicle_type").or(driverFilter.join(",")).limit(LIMIT),
    supabase.from("company_vehicles").select("id, plate, brand, model").or(`plate.ilike.${like},model.ilike.${like},brand.ilike.${like}`).limit(LIMIT),
    supabase
      .from("invoices")
      .select("id, nfe_number, recipient_name, address_city")
      .or(`nfe_number.ilike.${like},recipient_name.ilike.${like},access_key.ilike.${like}`)
      .order("imported_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("manifests")
      .select("id, manifest_code, driver_name, scheduled_date")
      .or(`manifest_code.ilike.${like},driver_name.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
  ]);

  const results: SearchResult[] = [];
  for (const d of drivers.data || []) {
    results.push({
      kind: "driver",
      id: d.id,
      title: d.name,
      subtitle: [d.vehicle_type ? vehicleTypeLabel(d.vehicle_type) : null, d.vehicle_plate].filter(Boolean).join(" • "),
      href: `/drivers?q=${q(d.name)}`,
    });
  }
  for (const v of vehicles.data || []) {
    results.push({
      kind: "vehicle",
      id: v.id,
      title: v.plate,
      subtitle: [v.brand, v.model].filter(Boolean).join(" "),
      href: `/vehicles?q=${q(v.plate)}`,
    });
  }
  for (const i of invoices.data || []) {
    const number = i.nfe_number || "";
    results.push({
      kind: "invoice",
      id: i.id,
      title: number ? `NF ${number}` : i.recipient_name || "Nota fiscal",
      subtitle: [i.recipient_name, i.address_city].filter(Boolean).join(" • "),
      href: `/deliveries?q=${q(number || i.recipient_name || term)}`,
    });
  }
  for (const m of manifests.data || []) {
    results.push({
      kind: "manifest",
      id: m.id,
      title: m.manifest_code,
      subtitle: m.driver_name || "",
      href: `/deliveries?tab=romaneios&q=${q(m.manifest_code)}`,
    });
  }
  return results;
}
