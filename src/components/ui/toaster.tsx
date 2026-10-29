import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const Icon = variant === "destructive" ? AlertCircle : variant === "success" ? CheckCircle2 : null;
        return (
          <Toast key={id} variant={variant} {...props}>
            {Icon && (
              <Icon
                aria-hidden="true"
                className={variant === "destructive" ? "mt-0.5 h-5 w-5 shrink-0 text-destructive" : "mt-0.5 h-5 w-5 shrink-0 text-success"}
              />
            )}
            <div className="grid flex-1 gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
