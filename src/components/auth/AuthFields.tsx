import { forwardRef, useState, type ReactNode } from "react";
import { CircleAlert, Eye, EyeOff, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FieldA11y {
  id: string;
  "aria-invalid": boolean | undefined;
  "aria-describedby": string | undefined;
}

interface AuthFieldProps {
  id: string;
  label: string;
  /** Explicacao curta embaixo do campo. */
  hint?: ReactNode;
  error?: string;
  icon?: LucideIcon;
  /** Acao ao lado do rotulo (ex.: "Esqueci minha senha"). */
  labelAction?: ReactNode;
  children: (a11y: FieldA11y) => ReactNode;
}

/**
 * Campo de formulario das telas publicas: rotulo ligado ao campo, dica e erro
 * embaixo (aria-describedby) e aria-invalid quando ha erro.
 */
export function AuthField({ id, label, hint, error, icon: Icon, labelAction, children }: AuthFieldProps) {
  const hintId = hint ? `${id}-dica` : undefined;
  const errorId = error ? `${id}-erro` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-2">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      <div className="relative">
        {Icon && (
          <Icon
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2",
              error ? "text-destructive" : "text-muted-foreground",
            )}
          />
        )}
        {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      </div>
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-destructive animate-fade-in">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

const authInputClass = "h-12 text-[0.9375rem]";

/** Campo das telas publicas: mais alto (bom para toque), com espaco para o icone. */
export const AuthInput = forwardRef<HTMLInputElement, React.ComponentProps<typeof Input> & { withIcon?: boolean }>(
  ({ className, withIcon, ...props }, ref) => (
    <Input ref={ref} className={cn(authInputClass, withIcon && "pl-11", className)} {...props} />
  ),
);
AuthInput.displayName = "AuthInput";

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  /** Controle externo (ex.: dois campos que mostram/ocultam juntos). */
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
};

/** Campo de senha com botao "Mostrar senha" (olho) dentro do campo. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, visible, onVisibleChange, ...props }, ref) => {
    const [ownVisible, setOwnVisible] = useState(false);
    const shown = visible ?? ownVisible;
    const toggle = () => (onVisibleChange ? onVisibleChange(!shown) : setOwnVisible(!shown));

    return (
      <>
        <Input ref={ref} type={shown ? "text" : "password"} className={cn(authInputClass, "pr-12", className)} {...props} />
        <button
          type="button"
          onClick={toggle}
          aria-label={shown ? "Ocultar senha" : "Mostrar senha"}
          aria-controls={props.id}
          disabled={props.disabled}
          className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {shown ? <EyeOff className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" /> : <Eye className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />}
        </button>
      </>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
