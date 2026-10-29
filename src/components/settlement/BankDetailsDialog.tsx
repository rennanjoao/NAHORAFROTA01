import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, CreditCard, KeyRound } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface BankDetails {
  banco?: string;
  agencia?: string;
  conta?: string;
  tipo_conta?: string;
  chave_pix?: string;
  cpf?: string;
  driverName?: string;
}

interface BankDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankDetails: BankDetails;
}

const tipoContaLabels: Record<string, string> = {
  corrente: "Conta corrente",
  poupanca: "Conta poupança",
  salario: "Conta salário",
};

export function BankDetailsDialog({ open, onOpenChange, bankDetails }: BankDetailsDialogProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        title: `${field} copiada`,
        description: "Cole no aplicativo do banco.",
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({
        title: "Não foi possível copiar",
        description: "Selecione o texto e copie manualmente.",
        variant: "destructive",
      });
    }
  };

  const copyButton = (text: string, field: string) => (
    <Button size="icon" variant="ghost" className="shrink-0" onClick={() => handleCopy(text, field)} aria-label={`Copiar ${field.toLowerCase()}`}>
      {copiedField === field ? <Check className="text-success" aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </Button>
  );

  const hasBankData = bankDetails.banco || bankDetails.agencia || bankDetails.conta;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dados bancários</DialogTitle>
          <DialogDescription>
            {bankDetails.driverName ? (
              <>
                Para pagar <span className="font-medium text-foreground">{bankDetails.driverName}</span>
                {bankDetails.cpf && <span className="font-data"> · CPF {bankDetails.cpf}</span>}
              </>
            ) : (
              "Use estes dados para fazer o pagamento."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* PIX */}
          <section aria-labelledby="bank-pix-title" className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <h3 id="bank-pix-title" className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Chave PIX
            </h3>
            {bankDetails.chave_pix ? (
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border bg-card px-3 py-2 font-data text-sm">
                  {bankDetails.chave_pix}
                </code>
                {copyButton(bankDetails.chave_pix, "Chave PIX")}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chave PIX não cadastrada. Peça ao motorista para informar no cadastro.</p>
            )}
          </section>

          {/* Transferencia */}
          <section aria-labelledby="bank-ted-title" className="rounded-lg border bg-muted/40 p-4">
            <h3 id="bank-ted-title" className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              Transferência (TED)
            </h3>

            {hasBankData ? (
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">Banco</dt>
                  <dd className="break-words font-medium">{bankDetails.banco || "—"}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">Tipo de conta</dt>
                  <dd>
                    <Badge variant="secondary">
                      {tipoContaLabels[bankDetails.tipo_conta || "corrente"] || bankDetails.tipo_conta}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">Agência</dt>
                  <dd className="flex items-center gap-1">
                    <span className="font-data font-medium">{bankDetails.agencia || "—"}</span>
                    {bankDetails.agencia && copyButton(bankDetails.agencia, "Agência")}
                  </dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">Conta</dt>
                  <dd className="flex items-center gap-1">
                    <span className="font-data font-medium">{bankDetails.conta || "—"}</span>
                    {bankDetails.conta && copyButton(bankDetails.conta, "Conta")}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Dados bancários não cadastrados.</p>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
