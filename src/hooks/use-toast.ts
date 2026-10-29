import type { ReactNode } from "react";
import { toast as sonner, type ExternalToast } from "sonner";

/**
 * Avisos rapidos do sistema. Mantem a API de sempre ({ title, description, variant })
 * e mostra tudo pelo Sonner: um lugar so, um visual so, e o aviso nao "rouba" o Esc
 * da janela aberta (o toast do Radix virava camada e fechava antes da janela).
 */
export type ToastVariant = "default" | "destructive" | "success";

export interface ToastOptions {
  title?: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant | null;
  duration?: number;
}

// Erro fica mais tempo na tela: e o aviso que a pessoa precisa ler com calma.
const ERROR_DURATION = 6000;

function show({ title, description, variant, duration }: ToastOptions, id?: string | number) {
  const message = title ?? description ?? "";
  const options: ExternalToast = { id, duration, description: title ? description : undefined };
  if (variant === "destructive") return sonner.error(message, { ...options, duration: duration ?? ERROR_DURATION });
  if (variant === "success") return sonner.success(message, options);
  return sonner(message, options);
}

function toast(options: ToastOptions) {
  const id = show(options);
  return {
    id: String(id),
    dismiss: () => sonner.dismiss(id),
    update: (next: ToastOptions) => show({ ...options, ...next }, id),
  };
}

function useToast() {
  return { toast, dismiss: (toastId?: string) => sonner.dismiss(toastId) };
}

export { useToast, toast };
