import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FieldControlProps {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  "aria-required"?: true;
}

interface FormFieldProps {
  id: string;
  label: ReactNode;
  /** Marca o campo como obrigatorio para leitor de tela. */
  required?: boolean;
  /** Mostra "(opcional)" ao lado do rotulo. */
  optional?: boolean;
  /** Dica curta abaixo do campo. */
  hint?: ReactNode;
  /** Mensagem de erro (mostrada abaixo do campo, ligada por aria-describedby). */
  error?: string | null;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * Campo de formulario padrao: rotulo ligado por htmlFor/id, dica e erro
 * anunciados pelo leitor de tela. O controle recebe as props por render prop.
 */
export function FormField({ id, label, required, optional, hint, error, className, children }: FormFieldProps) {
  const hintId = hint ? `${id}-dica` : undefined;
  const errorId = error ? `${id}-erro` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={id} className="flex flex-wrap items-baseline gap-x-1.5">
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">(opcional)</span>}
      </Label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        "aria-required": required ? true : undefined,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-xs font-medium text-destructive animate-fade-in">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

/** Titulo de um grupo de campos dentro de um formulario. */
export function FieldGroup({ title, description, children, className }: { title: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("space-y-4", className)}>
      <legend className="mb-1 text-sm font-semibold text-foreground">
        {title}
        {description && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{description}</span>}
      </legend>
      {children}
    </fieldset>
  );
}
