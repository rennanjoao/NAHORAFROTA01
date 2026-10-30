import { useState } from "react";
import { FileCheck2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantData } from "@/hooks/useTenantData";
import { cn } from "@/lib/utils";

const OPTIONS = [
  {
    value: "yes",
    title: "Sim, só pago com nota fiscal",
    description: "O agregado escolhe no app os dias que trabalhou e anexa a nota. O romaneio só é pago depois que a nota é aprovada.",
  },
  { value: "no", title: "Não, pago sem nota", description: "O acerto continua como hoje, sem exigir nota fiscal." },
] as const;

export const INVOICE_RULE_QUESTION = "Vocês só pagam o agregado mediante nota fiscal?";

/** Sim/Nao da regra da nota fiscal (obrigatorio em Dados da empresa). */
export function InvoiceRuleChoice({
  value,
  onChange,
  disabled,
  error,
  idPrefix = "",
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  error?: string | null;
  idPrefix?: string;
}) {
  const errorId = error ? `${idPrefix}regra-nota-erro` : undefined;
  return (
    <div className="space-y-2">
      <RadioGroup
        id={`${idPrefix}regra-nota`}
        value={value === null ? "" : value ? "yes" : "no"}
        onValueChange={(next) => onChange(next === "yes")}
        aria-label={INVOICE_RULE_QUESTION}
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        aria-required="true"
        disabled={disabled}
        className="grid gap-2 sm:grid-cols-2"
      >
        {OPTIONS.map((option) => {
          const checked = value !== null && (option.value === "yes") === value;
          const itemId = `${idPrefix}regra-nota-${option.value}`;
          return (
            <Label
              key={option.value}
              htmlFor={itemId}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3.5 font-normal transition-colors duration-fast hover:border-foreground/20",
                checked && "border-primary/60 bg-primary/5 ring-1 ring-primary/30",
                error && "border-destructive",
              )}
            >
              <RadioGroupItem id={itemId} value={option.value} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{option.title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{option.description}</span>
              </span>
            </Label>
          );
        })}
      </RadioGroup>
      {error && (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Acerto: enquanto a empresa nao responde, a pergunta aparece no topo. */
export function InvoiceRulePrompt() {
  const { tenant, updateTenant } = useTenantData();
  const { isAdmin } = useAuth();
  const [value, setValue] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  if (!tenant || tenant.pays_only_with_invoice !== null) return null;
  const canEdit = isAdmin();
  return (
    <Card className="border-warning/50 bg-warning/[0.06] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/20 text-warning">
          <FileCheck2 className="h-[1.125rem] w-[1.125rem]" />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">{INVOICE_RULE_QUESTION}</h2>
            <p className="text-sm text-muted-foreground">
              {canEdit ? "Responda uma vez; dá para mudar em Configurações > Dados da empresa." : "O administrador da conta precisa responder em Configurações > Dados da empresa."}
            </p>
          </div>
          {canEdit && (
            <>
              <InvoiceRuleChoice idPrefix="acerto-" value={value} onChange={setValue} disabled={saving} />
              <Button
                disabled={value === null || saving}
                onClick={async () => {
                  setSaving(true);
                  await updateTenant({ pays_only_with_invoice: value });
                  setSaving(false);
                }}
              >
                {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                Salvar resposta
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
