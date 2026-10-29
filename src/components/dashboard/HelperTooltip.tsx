import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HelperTooltipProps {
  term: string;
  explanation: string;
}

export function HelperTooltip({ term, explanation }: HelperTooltipProps) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label={`Ajuda sobre ${term}`}
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[280px] text-sm"
        >
          <p className="font-medium text-foreground mb-1">{term}</p>
          <p className="text-muted-foreground">{explanation}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
