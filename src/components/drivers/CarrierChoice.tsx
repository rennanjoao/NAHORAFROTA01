import { Link } from "react-router-dom";
import { UserRound, Warehouse } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/patterns/FormField";
import { carrierName, useCarriers } from "@/hooks/useCarriers";
import { cn } from "@/lib/utils";

/**
 * Agregado: recebe direto (TAC, envia a propria nota) ou por uma transportadora (o
 * acerto e a nota fiscal saem para ela).
 */
export function CarrierChoice({ carrierId, onChange, idPrefix = "" }: { carrierId: string | null; onChange: (carrierId: string | null) => void; idPrefix?: string }) {
  const { carriers } = useCarriers();
  const active = carriers.filter((carrier) => carrier.active || carrier.id === carrierId);
  const options = [
    { value: "tac", title: "Direto (TAC)", description: "Recebe no próprio nome e envia a nota fiscal dele.", icon: UserRound, disabled: false },
    {
      value: "carrier",
      title: "Por transportadora",
      description: active.length ? "O acerto e a nota saem para a transportadora." : "Cadastre uma transportadora antes.",
      icon: Warehouse,
      disabled: active.length === 0,
    },
  ];

  return (
    <div className="space-y-3">
      <RadioGroup
        value={carrierId ? "carrier" : "tac"}
        onValueChange={(value) => onChange(value === "carrier" ? (active[0]?.id ?? null) : null)}
        aria-label="Como o agregado recebe"
        className="grid gap-2 sm:grid-cols-2"
      >
        {options.map(({ value, title, description, icon: Icon, disabled }) => {
          const checked = (value === "carrier") === !!carrierId;
          const itemId = `${idPrefix}recebe-${value}`;
          return (
            <Label
              key={value}
              htmlFor={itemId}
              className={cn(
                "flex items-start gap-3 rounded-lg border bg-card p-3.5 font-normal transition-colors duration-fast",
                disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-foreground/20",
                checked && "border-primary/60 bg-primary/5 ring-1 ring-primary/30",
              )}
            >
              <RadioGroupItem id={itemId} value={value} disabled={disabled} className="mt-0.5" />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {title}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{description}</span>
              </span>
            </Label>
          );
        })}
      </RadioGroup>
      {carrierId && (
        <FormField id={`${idPrefix}transportadora`} label="Transportadora">
          {(control) => (
            <Select value={carrierId} onValueChange={(value) => onChange(value)}>
              <SelectTrigger {...control}>
                <SelectValue placeholder="Escolha a transportadora" />
              </SelectTrigger>
              <SelectContent>
                {active.map((carrier) => (
                  <SelectItem key={carrier.id} value={carrier.id}>
                    {carrierName(carrier)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      )}
      {active.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Motorista de transportadora?{" "}
          <Link to="/carriers?action=new" className="font-medium text-primary underline-offset-4 hover:underline">
            Cadastre a transportadora
          </Link>{" "}
          e depois volte aqui.
        </p>
      )}
    </div>
  );
}
