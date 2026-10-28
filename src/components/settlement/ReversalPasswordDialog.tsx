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
import { AlertTriangle, Lock, RotateCcw } from "lucide-react";
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
          title: "❌ Senha Incorreta",
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
        title: "✅ Estorno Autorizado",
        description: "O valor foi revertido para 'A Pagar'. Ação registrada no log de auditoria.",
      });
      onOpenChange(false);
      setPassword("");
      setRemainingAttempts(null);
    } catch (err: any) {
      console.error("Error during reversal:", err);
      setError(err.message || "Erro ao processar estorno");
      toast({
        title: "❌ Erro",
        description: err.message || "Não foi possível processar o estorno.",
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
           <AlertDialogTitle className="flex items-center gap-2 text-destructive">
             <AlertTriangle className="h-5 w-5" />
             Confirmar Estorno
           </AlertDialogTitle>
           <AlertDialogDescription className="space-y-2">
             <p>
               Você está prestes a reverter o status de <strong>"Pago"</strong> para{" "}
               <strong>"A Pagar"</strong>.
             </p>
             {manifestCode && (
               <p className="font-mono text-sm bg-muted p-2 rounded">
                 Romaneio: {manifestCode}
               </p>
             )}
             <p className="text-destructive font-medium">
               Esta ação será registrada no log de auditoria.
             </p>
           </AlertDialogDescription>
         </AlertDialogHeader>
 
         <div className="py-4 space-y-4">
           <div className="space-y-2">
             <Label htmlFor="reversal-password" className="flex items-center gap-2">
               <Lock className="h-4 w-4" />
               Senha de Segurança
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
               className={error ? "border-destructive" : ""}
               autoFocus
             />
             {error && (
               <p className="text-sm text-destructive">{error}</p>
             )}
           </div>
         </div>
 
         <AlertDialogFooter>
           <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
           <Button
             variant="destructive"
             onClick={handleConfirm}
             disabled={!password || isLoading}
             className="gap-2"
           >
             <RotateCcw className="h-4 w-4" />
             {isLoading ? "Processando..." : "Confirmar Estorno"}
           </Button>
         </AlertDialogFooter>
       </AlertDialogContent>
     </AlertDialog>
   );
 }