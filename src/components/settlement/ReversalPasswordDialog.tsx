import { useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2, Lock, RotateCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { readEdgeFunctionError } from "@/lib/edgeFunctionError";

// Respostas fora de 2xx da validacao, em linguagem simples (antes: "non-2xx status code").
async function reversalErrorMessage(error: unknown): Promise<string> {
  const info = await readEdgeFunctionError(error, "Não foi possível validar a senha. Tente de novo em instantes.");
  if (info.status === 401) return "Sua sessão expirou. Entre de novo e repita o estorno.";
  if (info.status === 500 && /not configured/i.test(info.message)) {
    return "A senha de estorno ainda não foi configurada. Fale com o suporte Na Hora.";
  }
  if (info.status === 500) return "Não foi possível validar a senha. Tente de novo em instantes.";
  return info.message;
}

interface ReversalPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<boolean | void> | boolean | void;
  settlementId?: string;
  /** Id do romaneio (vai para a validacao e o historico). */
  manifestCode?: string;
  /** Numero do romaneio para a pessoa ler (ex.: 1/2026). Sem ele, mostra o id. */
  manifestLabel?: string;
  driverName?: string;
}

export function ReversalPasswordDialog({
  open,
  onOpenChange,
  onConfirm,
  settlementId,
  manifestCode,
  manifestLabel,
  driverName,
}: ReversalPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleConfirm = async () => {
    setError("");
    setIsLoading(true);
    
    try {
      // Validate password via server-side edge function
      const { data, error: fnError } = await supabase.functions.invoke('validate-reversal', {
        body: {
          password,
          action: 'reversal',
          settlementId,
          manifestCode
        }
      });

      if (fnError) {
        throw new Error(await reversalErrorMessage(fnError));
      }

      if (!data?.valid) {
        setRemainingAttempts(data?.remainingAttempts ?? null);
        const left = data?.remainingAttempts;
        const attemptsMsg = left !== undefined ? ` ${left === 1 ? "Resta 1 tentativa." : `Restam ${left} tentativas.`}` : "";
        // So o erro no campo (role=alert): um aviso solto roubava o primeiro Esc da janela.
        setError(`${data?.error || "Senha de estorno incorreta"}.${attemptsMsg}`);
        return;
      }

      // Password validated server-side, log the reversal action
      const userData = { user: (await supabase.auth.getSession()).data.session?.user ?? null };
      
      // performed_at vai explicito: sem o padrao now() no banco, o registro falhava calado.
      const { error: auditError } = await supabase.from("settlement_audit_logs").insert({
        performed_at: new Date().toISOString(),
        settlement_id: settlementId || null,
        action_type: "reversal",
        previous_status: "paid",
        new_status: "open",
        performed_by: userData?.user?.id || null,
        notes: `Estorno autorizado para ${driverName || "motorista"} - Romaneio: ${manifestLabel ? `${manifestLabel} (${manifestCode})` : manifestCode || "N/A"}`,
      });

      if (auditError) console.error("Reversal audit log failed:", auditError);

      const reverted = await onConfirm();
      if (reverted === false) return;

      toast({
        title: "Estorno feito",
        description: auditError
          ? "O romaneio voltou para \"a pagar\"."
          : "O romaneio voltou para \"a pagar\". A ação ficou registrada no histórico.",
      });
      onOpenChange(false);
      setPassword("");
      setRemainingAttempts(null);
    } catch (err: unknown) {
      console.error("Error during reversal:", err);
      const message = err instanceof Error ? err.message : "";
      setError(message || "Não foi possível estornar. Tente de novo em instantes.");
    } finally {
      setIsLoading(false);
    }
  };
 
  const handleClose = () => {
    setPassword("");
    setError("");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent
        className="sm:max-w-md"
        // Foco no campo da senha. Antes o autoFocus fazia a janela "lembrar" do proprio campo
        // e, ao fechar, o foco ia para o topo da pagina em vez do botao Estornar.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
            Estornar pagamento?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                O romaneio sai de <strong className="text-foreground">pago</strong> e volta para{" "}
                <strong className="text-foreground">a pagar</strong>. A ação fica registrada no histórico.
              </p>
              {(manifestLabel || manifestCode) && (
                <p className="truncate rounded-md bg-muted px-3 py-2 text-xs text-foreground">
                  Romaneio <span className="font-data font-semibold">{manifestLabel || manifestCode}</span>
                  {driverName && <> · {driverName}</>}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (password && !isLoading) void handleConfirm();
          }}
        >
          <Label htmlFor="reversal-password" className="flex items-center gap-2">
            <Lock className="h-4 w-4" aria-hidden="true" />
            Senha de estorno
          </Label>
          <Input
            id="reversal-password"
            ref={inputRef}
            type="password"
            placeholder="Digite a senha de estorno"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            aria-invalid={Boolean(error)}
            className={error ? "border-destructive" : undefined}
            aria-describedby={error ? "reversal-password-error" : undefined}
          />
          {error && (
            <p id="reversal-password-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={handleConfirm} disabled={!password || isLoading}>
            {isLoading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
            {isLoading ? "Estornando..." : "Estornar pagamento"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
