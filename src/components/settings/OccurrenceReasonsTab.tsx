import { useState, type FormEvent } from "react";
import { Check, ListChecks, Loader2, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/patterns";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOccurrenceReasons } from "@/hooks/useOccurrenceReasons";
import { reasonCode, type OccurrenceReason } from "@/lib/occurrenceReasons";
import { getCurrentTenantId } from "@/lib/tenant";
import { SettingsCard } from "./SettingsCard";

const fail = (description: string) => toast({ title: "Não foi possível salvar", description, variant: "destructive" });

/**
 * Configuracoes > Ocorrencias: a lista de motivos que o motorista pode escolher no app
 * (e o painel, ao registrar uma ocorrencia). Desativar tira o motivo da lista sem
 * apagar o historico das notas que ja usaram.
 */
export function OccurrenceReasonsTab() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("admin") || hasRole("fleet_manager") || hasRole("dispatcher");
  const { reasons, isLoading, refetch } = useOccurrenceReasons();
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Lista padrao sem banco (atualizacao ainda nao rodada): so leitura.
  const usingFallback = reasons.length > 0 && reasons.every((reason) => reason.id === reason.code);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const label = newLabel.trim();
    if (label.length < 2) return fail("Escreva o motivo (ex.: Loja fechada).");
    const code = reasonCode(label);
    if (reasons.some((reason) => reason.code === code)) return fail("Esse motivo já está na lista.");
    setAdding(true);
    const tenantId = await getCurrentTenantId();
    const { error } = await supabase.from("occurrence_reasons").insert({
      tenant_id: tenantId!,
      code,
      label,
      sort_order: Math.max(0, ...reasons.map((reason) => reason.sort_order)) + 10,
    });
    setAdding(false);
    if (error) return fail("Confira a internet e tente de novo.");
    setNewLabel("");
    toast({ title: "Motivo incluído", description: `"${label}" já aparece no app do motorista.` });
    void refetch();
  };

  const update = async (reason: OccurrenceReason, changes: Partial<Pick<OccurrenceReason, "label" | "active">>) => {
    setBusyId(reason.id);
    const { error } = await supabase
      .from("occurrence_reasons")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", reason.id);
    setBusyId(null);
    if (error) return fail("Confira a internet e tente de novo.");
    setEditing(null);
    void refetch();
  };

  const saveLabel = (event: FormEvent, reason: OccurrenceReason) => {
    event.preventDefault();
    const label = editing?.label.trim() ?? "";
    if (label.length < 2) return fail("Escreva o nome do motivo.");
    void update(reason, { label });
  };

  const activeCount = reasons.filter((reason) => reason.active).length;

  return (
    <SettingsCard
      icon={ListChecks}
      title="Motivos de ocorrência"
      description="O motorista só escolhe entre os motivos ligados aqui. Ele ainda pode escrever uma observação."
      footerHint={
        usingFallback
          ? "Lista padrão. Para editar, rode a atualização do banco (supabase/ATUALIZAR_BANCO.sql)."
          : `${activeCount} de ${reasons.length} motivos aparecem no app. Desligar não apaga o histórico das notas.`
      }
    >
      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <ul className="divide-y rounded-lg border">
            {reasons.map((reason) => {
              const isEditing = editing?.id === reason.id;
              const busy = busyId === reason.id;
              return (
                <li key={reason.id} className="flex min-h-[3.25rem] items-center gap-3 px-3 py-2">
                  {isEditing ? (
                    <form onSubmit={(event) => saveLabel(event, reason)} className="flex flex-1 items-center gap-2">
                      <Input
                        autoFocus
                        aria-label={`Novo nome para ${reason.label}`}
                        value={editing.label}
                        maxLength={60}
                        onChange={(event) => setEditing({ id: reason.id, label: event.target.value })}
                        className="h-9"
                      />
                      <Button type="submit" size="icon-sm" disabled={busy} aria-label="Salvar nome">
                        {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                      </Button>
                      <Button type="button" size="icon-sm" variant="ghost" onClick={() => setEditing(null)} aria-label="Cancelar">
                        <X aria-hidden="true" />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <span className={reason.active ? "flex-1 text-sm font-medium text-foreground" : "flex-1 text-sm text-muted-foreground line-through"}>
                        {reason.label}
                      </span>
                      {!reason.active && <StatusBadge tone="neutral">Desligado</StatusBadge>}
                      {canEdit && !usingFallback && (
                        <>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setEditing({ id: reason.id, label: reason.label })}
                            aria-label={`Renomear ${reason.label}`}
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                          <Switch
                            checked={reason.active}
                            disabled={busy}
                            onCheckedChange={(active) => void update(reason, { active })}
                            aria-label={`${reason.label}: aparece no app`}
                          />
                        </>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          {canEdit && !usingFallback && (
            <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
              <Input
                aria-label="Novo motivo de ocorrência"
                placeholder="Novo motivo (ex.: Loja fechada para balanço)"
                value={newLabel}
                maxLength={60}
                onChange={(event) => setNewLabel(event.target.value)}
              />
              <Button type="submit" disabled={adding} className="shrink-0">
                {adding ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
                Incluir motivo
              </Button>
            </form>
          )}
          {!canEdit && <p className="text-sm text-muted-foreground">Só administradores, gestores e despachantes alteram a lista.</p>}
        </div>
      )}
    </SettingsCard>
  );
}
