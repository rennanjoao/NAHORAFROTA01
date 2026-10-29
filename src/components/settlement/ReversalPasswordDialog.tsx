import { useState } from "react";
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

interface ReversalPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<boolean | void> | boolean | void;
  settlementId?: string;
  manifestCode?: string;
  driverName?: string;
}

export function ReversalPasswordDialog({
  open,
  onOpenChange,
  onConfirm,
  settlementId,
  manifestCode,
  driverName,
}: ReversalPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

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
        throw new Error(fnError.message || 'Erro ao validar senha');
      }

      if (!data.valid) {
        setRemainingAttempts(data.remainingAttempts ?? null);
        const attemptsMsg = data.remainingAttempts !== undefined 
          ? ` (${data.remainingAttempts} tentativas restantes)` 
          : '';
        setError(`${data.error || 'Senha incorreta'}${attemptsMsg}`);
        toast({
          title: "Senha incorreta",
          description: data.error || "A senha de estorno informada está incorreta.",
          variant: "destructive",
        });
        return;
      }

      // Password validated server-side, log the reversal action
      const { data: userData } = await supabase.auth.getUser();
      
      await supabase.from("settlement_audit_logs").insert({
        settlement_id: settlementId || null,
        action_type: "reversal",
        previous_status: "paid",
        new_status: "open",
        performed_by: userData?.user?.id || null,
        notes: `Estorno autorizado para ${driverName || "motorista"} - Romaneio: ${manifestCode || "N/A"}`,
      });

      const reverted = await onConfirm();
      if (reverted === false) return;

      toast({
        title: "Estorno feito",
        description: "O romaneio voltou para \"a pagar\". A ação ficou registrada no histórico.",
      });
      onOpenChange(false);
      setPassword("");
      setRemainingAttempts(null);
    } catch (err: unknown) {
      console.error("Error during reversal:", err);
      const message = err instanceof Error ? err.message : "";
      setError(message || "Erro ao processar estorno");
      toast({
        title: "Não foi possível estornar",
        description: message || "Tente de novo em instantes.",
        variant: "destructive",
      });
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
      <AlertDialogContent className="sm:max-w-md">
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
              {manifestCode && (
                <p className="truncate rounded-md bg-muted px-3 py-2 font-data text-xs">Romaneio: {manifestCode}</p>
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
            autoFocus
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
            {isLoading ? "Estornando" : "Estornar pagamento"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
