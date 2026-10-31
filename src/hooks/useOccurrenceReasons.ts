import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_OCCURRENCE_REASONS, reasonLabel, type OccurrenceReason } from "@/lib/occurrenceReasons";

const FALLBACK: OccurrenceReason[] = DEFAULT_OCCURRENCE_REASONS.map((reason) => ({ ...reason, id: reason.code }));

async function loadReasons(): Promise<OccurrenceReason[]> {
  // O RLS so devolve os motivos da empresa de quem esta logado (painel ou app do motorista).
  const { data, error } = await supabase
    .from("occurrence_reasons")
    .select("id, code, label, active, sort_order")
    .order("sort_order")
    .order("label");
  // Banco sem a tabela ainda (atualizacao nao rodada): segue com a lista padrao.
  if (error) return FALLBACK;
  return data.length > 0 ? data : FALLBACK;
}

/** Motivos de ocorrencia da empresa (todos, para o cadastro; `active` para escolher). */
export function useOccurrenceReasons() {
  const { user } = useAuth();
  const query = useQuery({ queryKey: ["occurrence-reasons", user?.id], queryFn: loadReasons, enabled: !!user, staleTime: 5 * 60 * 1000 });
  const reasons = query.data ?? FALLBACK;
  return {
    reasons,
    active: reasons.filter((reason) => reason.active),
    labelFor: (code: string | null | undefined) => reasonLabel(code, reasons),
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
