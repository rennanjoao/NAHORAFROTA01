import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toneSoftBg, toneText, type Tone } from "@/components/patterns";
import { cn } from "@/lib/utils";

interface DetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  /** Acima do titulo (ex.: botao "Voltar"). */
  leading?: ReactNode;
  /** Abaixo do titulo, fixo (resumo, botoes). */
  summary?: ReactNode;
  /** Rodape fixo com a acao principal. */
  footer?: ReactNode;
  /** Nome da area rolavel para leitor de tela. */
  bodyLabel?: string;
  /** Para devolver o foco a outro botao ao fechar (ex.: janela aberta de dentro de outra). */
  onCloseAutoFocus?: (event: Event) => void;
  children: ReactNode;
  className?: string;
}

function PanelHeading({ icon: Icon, tone = "brand", title, description, kind }: Pick<DetailPanelProps, "icon" | "tone" | "title" | "description"> & { kind: "sheet" | "dialog" }) {
  const Title = kind === "sheet" ? SheetTitle : DialogTitle;
  const Description = kind === "sheet" ? SheetDescription : DialogDescription;
  return (
    // pr-10: espaco do botao fechar (o resumo abaixo usa a largura toda)
    <div className="flex items-start gap-3 pr-10">
      {Icon && (
        <span aria-hidden="true" className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", toneSoftBg[tone], toneText[tone])}>
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0 space-y-0.5">
        <Title>{title}</Title>
        {description ? <Description>{description}</Description> : <Description className="sr-only">Detalhes</Description>}
      </div>
    </div>
  );
}

// Area rolavel: focavel para quem navega pelo teclado (rolar com as setas).
const bodyClass =
  "min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6";

/** Painel lateral de detalhes: cabecalho e rodape fixos, lista rolando no meio. */
export function DetailSheet({ open, onOpenChange, leading, summary, footer, bodyLabel, onCloseAutoFocus, children, className, ...heading }: DetailPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent onCloseAutoFocus={onCloseAutoFocus} className={cn("flex w-full flex-col gap-0 p-0 sm:max-w-lg", className)}>
        <SheetHeader className="gap-3 border-b px-5 pb-4 pt-5 sm:px-6">
          {leading}
          <PanelHeading kind="sheet" {...heading} />
          {summary}
        </SheetHeader>
        <div tabIndex={0} role="region" aria-label={bodyLabel ?? "Lista"} className={bodyClass}>
          {children}
        </div>
        {footer && <div className="border-t px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}

/** Janela de detalhes (folha inferior no celular), mesmo desenho do DetailSheet. */
export function DetailDialog({ open, onOpenChange, leading, summary, footer, bodyLabel, onCloseAutoFocus, children, className, ...heading }: DetailPanelProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} className={cn("flex flex-col gap-0 overflow-hidden p-0 pt-3 sm:max-w-2xl sm:p-0", className)}>
        <DialogHeader className="gap-3 border-b px-5 pb-4 pt-2 sm:px-6 sm:pt-6">
          {leading}
          <PanelHeading kind="dialog" {...heading} />
          {summary}
        </DialogHeader>
        <div tabIndex={0} role="region" aria-label={bodyLabel ?? "Lista"} className={bodyClass}>
          {children}
        </div>
        {footer && <div className="border-t px-5 py-4 sm:px-6">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}
