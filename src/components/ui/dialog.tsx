import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { useAutoReturnFocus } from "@/hooks/useReturnFocus";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[1000] bg-overlay backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * No celular a janela sobe de baixo (folha inferior, ao alcance do polegar);
 * da tela media para cima, fica centralizada e cresce suavemente.
 */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    hideClose?: boolean;
    /** "top": ancorada no alto da tela (busca), em vez de centralizada. */
    position?: "center" | "top";
  }
>(({ className, children, hideClose, position = "center", onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  // Janela aberta por um botao comum (sem DialogTrigger): o foco volta para ele ao fechar.
  const focusReturn = useAutoReturnFocus(onOpenAutoFocus, onCloseAutoFocus);
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed inset-x-0 bottom-0 z-[1000] grid max-h-[92dvh] w-full grid-cols-[minmax(0,1fr)] gap-4 overflow-y-auto overscroll-contain rounded-t-2xl border-t bg-popover p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-popover-foreground shadow-xl",
          "duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:max-h-[90vh] sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:rounded-xl sm:border sm:duration-200",
          "sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=closed]:slide-out-to-left-1/2",
          position === "center"
            ? "sm:top-1/2 sm:-translate-y-1/2 sm:data-[state=open]:slide-in-from-top-[48%] sm:data-[state=closed]:slide-out-to-top-[48%]"
            : "sm:top-[12vh] sm:translate-y-0 sm:data-[state=open]:slide-in-from-top-2 sm:data-[state=closed]:slide-out-to-top-2",
          className,
        )}
        {...props}
        {...focusReturn}
      >
        <div
          aria-hidden="true"
          className="mx-auto -mt-2 mb-1 h-1.5 w-10 rounded-full bg-muted-foreground/25 sm:hidden"
        />
        {children}
        {!hideClose && (
          <DialogPrimitive.Close className="absolute right-2 top-2 inline-flex h-12 w-12 items-center justify-center rounded-full text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none sm:right-3 sm:top-3 sm:h-9 sm:w-9">
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1.5 pr-8 text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("font-heading text-lg font-semibold leading-snug tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
