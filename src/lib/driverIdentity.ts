import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface ResolvedDriver {
  id: string;
  user_id: string | null;
  email: string | null;
  cpf: string | null;
  name: string | null;
  vehicle_plate?: string | null;
  vehicle_type?: string | null;
  photo?: string | null;
}

function normalizeCpf(value?: string | null): string | null {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

function formatCpf(value?: string | null): string | null {
  const digits = normalizeCpf(value);
  if (!digits || digits.length !== 11) return null;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

function normalizeName(user: User): string | null {
  const metadata = user.user_metadata as { name?: string; full_name?: string } | undefined;
  const rawName = metadata?.name || metadata?.full_name || "";
  const normalized = rawName.trim().toLowerCase();
  return normalized || null;
}

export async function resolveDriverForUser(user: User): Promise<ResolvedDriver | null> {
  const normalizedEmail = user.email?.trim().toLowerCase() || null;
  const normalizedCpf = normalizeCpf((user.user_metadata as { cpf?: string } | undefined)?.cpf);
  const formattedCpf = formatCpf(normalizedCpf);
  const normalizedName = normalizeName(user);

  const { data: drivers, error } = await supabase
    .from("drivers")
    .select("id, user_id, email, cpf, name, vehicle_plate, vehicle_type, photo_url")
    .or(
      [
        `user_id.eq.${user.id}`,
        normalizedEmail ? `email.eq.${normalizedEmail}` : null,
        normalizedCpf ? `cpf.eq.${normalizedCpf}` : null,
        formattedCpf ? `cpf.eq.${formattedCpf}` : null,
      ]
        .filter(Boolean)
        .join(","),
    );

  if (error) throw error;

  const matchedDriver =
    drivers?.find((driver) => driver.user_id === user.id) ||
    drivers?.find((driver) => normalizedEmail && driver.email?.trim().toLowerCase() === normalizedEmail) ||
    drivers?.find((driver) => normalizedCpf && normalizeCpf(driver.cpf) === normalizedCpf) ||
    null;

  if (matchedDriver) {
    return {
      ...matchedDriver,
      photo: (matchedDriver as any).photo_url ?? null,
    };
  }

  if (!normalizedName) {
    return null;
  }

  const { data: byName, error: byNameError } = await supabase
    .from("drivers")
    .select("id, user_id, email, cpf, name, vehicle_plate, vehicle_type, photo_url")
    .ilike("name", normalizedName)
    .limit(1);

  if (byNameError) throw byNameError;

  if (!byName?.[0]) {
    return null;
  }

  return {
    ...byName[0],
    photo: (byName[0] as any).photo_url ?? null,
  };
}
