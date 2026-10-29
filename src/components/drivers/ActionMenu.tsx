import { Fragment, useRef, type ReactElement } from "react";
import type { LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ActionMenuItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Linha divisoria antes do item. */
  separatorBefore?: boolean;
  /** Roda na hora (ex.: abrir WhatsApp). Sem isso, espera o menu fechar. */
  immediate?: boolean;
}

interface ActionMenuProps {
  /** Botao que abre o menu (precisa ter nome, ex.: aria-label "Acoes de Joao"). */
  trigger: ReactElement;
  items: ActionMenuItem[];
  title?: string;
  titleClassName?: string;
  align?: "start" | "end";
  className?: string;
}

/**
 * Menu de acoes. A acao que abre janela so roda depois que o menu devolve o
 * foco ao botao: assim, ao fechar a janela, o foco volta para o mesmo botao
 * (e nao para o topo da pagina).
 */
export function ActionMenu({ trigger, items, title, titleClassName, align = "end", className }: ActionMenuProps) {
  const pending = useRef<(() => void) | null>(null);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={cn("w-56", className)}
        onCloseAutoFocus={() => {
          const action = pending.current;
          pending.current = null;
          // O Radix foca o botao logo depois deste evento; a acao vem em seguida.
          if (action) window.setTimeout(action, 0);
        }}
      >
        {title && <DropdownMenuLabel className={cn("truncate", titleClassName)}>{title}</DropdownMenuLabel>}
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Fragment key={item.label}>
              {item.separatorBefore && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={item.disabled}
                onSelect={() => {
                  if (item.immediate) item.onSelect();
                  else pending.current = item.onSelect;
                }}
                className={cn(item.destructive && "text-destructive focus:bg-destructive/10 focus:text-destructive")}
              >
                <Icon aria-hidden="true" />
                {item.label}
              </DropdownMenuItem>
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
