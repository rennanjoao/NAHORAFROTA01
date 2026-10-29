import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Atributos que o campo recebe para ficar ligado ao rotulo, a dica e ao erro. */
export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

interface FormFieldProps {
  id: string;
  label: ReactNode;
  /** Uma linha, em portugues simples, do que colocar no campo. */
  hint?: ReactNode;
  /** Erro de validacao: aparece abaixo do campo e marca aria-invalid. */
  error?: string | null;
  /** Mostra "(opcional)" ao lado do rotulo. Campos sem a marca sao obrigatorios. */
  optional?: boolean;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/** Campo de formulario padrao: rotulo ligado ao campo, dica e erro logo abaixo. */
export function FormField({ id, label, hint, error, optional, className, children }: FormFieldProps) {
  const hintId = hint ? `${id}-dica` : undefined;
  const errorId = error ? `${id}-erro` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={id} className="flex flex-wrap items-baseline gap-x-1.5">
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">(opcional)</span>}
      </Label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && (
        <p id={hintId} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-[0.8125rem] font-medium text-destructive animate-fade-in">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
