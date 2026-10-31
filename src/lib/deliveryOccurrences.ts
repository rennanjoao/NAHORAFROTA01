import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/*
 * delivery_occurrences em producao veio do bootstrap com a coluna "type" e sem
 * occurrence_type, que e o que o app usa. A atualizacao do banco cria occurrence_type e
 * mantem as duas iguais; ate ela rodar, leitura e gravacao repetem com a coluna antiga.
 */

type Result = { data: unknown[] | null; error: PostgrestError | null };

/** Coluna que nao existe: 42703 no select, PGRST204 no insert. */
export function isMissingColumn(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

/**
 * Le ocorrencias. `query` recebe o pedaco do select do motivo ("occurrence_type" ou, no
 * banco antigo, "occurrence_type:type", que devolve a coluna antiga com o nome novo).
 */
export async function readDeliveryOccurrences<Row>(query: (typeColumn: string) => PromiseLike<Result>): Promise<{ data: Row[]; error: PostgrestError | null }> {
  let result = await query("occurrence_type");
  if (isMissingColumn(result.error)) result = await query("occurrence_type:type");
  return { data: (result.data ?? []) as Row[], error: result.error };
}

export interface NewDeliveryOccurrence {
  invoice_id: string;
  delivery_id: string | null;
  driver_id: string | null;
  occurrence_type: string;
  description: string | null;
  photo_url: string | null;
}

/** Grava a ocorrencia; no banco antigo o motivo vai na coluna "type". */
export async function insertDeliveryOccurrence(row: NewDeliveryOccurrence): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase.from("delivery_occurrences").insert(row);
  if (!isMissingColumn(error)) return { error };
  const { occurrence_type, ...rest } = row;
  // "type" nao esta no types.ts (que ja tem a coluna nova)
  return supabase.from("delivery_occurrences").insert({ ...rest, type: occurrence_type } as never);
}
