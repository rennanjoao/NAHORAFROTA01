import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

interface PixCopyButtonProps {
  pixKey?: string;
  cpf?: string;
  /** Botao unico "Copiar PIX" (cabecalho do motorista). */
  compact?: boolean;
}

export function PixCopyButton({ pixKey, cpf, compact = false }: PixCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  // Usa a chave PIX; sem chave, o CPF
  const keyToCopy = pixKey || cpf;

  const handleCopy = async () => {
    if (!keyToCopy) return;

    try {
      await navigator.clipboard.writeText(keyToCopy);
      setCopied(true);
      toast({
        title: "Chave PIX copiada",
        description: pixKey ? "Cole no aplicativo do banco para pagar." : "Sem chave cadastrada: copiamos o CPF.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Não foi possível copiar",
        description: "Copie a chave manualmente nos dados bancários.",
        variant: "destructive",
      });
    }
  };

  if (!keyToCopy) {
    return null;
  }

  const icon = copied ? <Check className="text-success" aria-hidden="true" /> : <Copy aria-hidden="true" />;

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="soft" onClick={handleCopy}>
            {icon}
            {copied ? "PIX copiado" : "Copiar PIX"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{pixKey ? `Chave: ${keyToCopy}` : `Sem chave PIX. Copia o CPF: ${keyToCopy}`}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="font-data">
        <KeyRound aria-hidden="true" />
        {pixKey ? "PIX" : "CPF"}
      </Badge>
      <code className="max-w-[120px] truncate font-data text-xs text-muted-foreground">{keyToCopy}</code>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon-sm" variant="outline" onClick={handleCopy} aria-label="Copiar chave PIX">
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copiar chave PIX</TooltipContent>
      </Tooltip>
    </div>
  );
}
