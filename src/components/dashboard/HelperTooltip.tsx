import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface HelperTooltipProps {
  term: string;
  explanation: string;
}

/**
 * Ajuda contextual. Era um Tooltip, que nao abre com toque: no celular o icone
 * nao fazia nada. Agora abre ao tocar ou clicar.
 */
export function HelperTooltip({ term, explanation }: HelperTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label={`Ajuda sobre ${term}`}
          // Nao deixa o clique chegar ao card clicavel em volta.
          onClick={(event) => event.stopPropagation()}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-auto max-w-[280px] p-3 text-sm"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <p className="font-medium text-foreground mb-1">{term}</p>
        <p className="text-muted-foreground">{explanation}</p>
      </PopoverContent>
    </Popover>
  );
}

// Predefined helper texts for common terms
export const helperTexts = {
  sla: {
    term: "SLA (Nível de Serviço)",
    explanation: "Mostra a porcentagem de entregas feitas dentro do prazo combinado com o cliente.",
  },
  otif: {
    term: "OTIF Score",
    explanation: "On-Time In-Full: Mede se a entrega chegou no prazo E completa (sem faltas ou avarias).",
  },
  risco: {
    term: "Probabilidade de Risco",
    explanation: "Percentual calculado pela IA indicando a chance do motorista não conseguir finalizar a rota hoje.",
  },
  detratores: {
    term: "Detratores",
    explanation: "Motoristas que estão impactando negativamente a média geral de desempenho da operação.",
  },
  ear: {
    term: "EAR",
    explanation: "Exame de Aptidão para Renovação - exame médico obrigatório para renovação da CNH.",
  },
  mopp: {
    term: "MOPP",
    explanation: "Movimentação Operacional de Produtos Perigosos - certificação para transportar cargas perigosas.",
  },
  rntrc: {
    term: "RNTRC",
    explanation: "Registro Nacional de Transportadores Rodoviários de Cargas - obrigatório para transporte remunerado.",
  },
};
