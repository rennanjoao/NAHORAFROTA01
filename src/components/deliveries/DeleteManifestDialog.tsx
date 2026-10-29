import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Lock, Trash2, Truck, Loader2 } from "lucide-react";
import { ManifestRecord } from "@/stores/manifestStore";
import { supabase } from "@/integrations/supabase/client";

interface DeleteManifestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manifest: ManifestRecord | null;
  onConfirm: (manifestId: string) => void;
  canDelete: boolean;
  blockReason?: string;
  completedCount?: number;
  /** Bloqueio que nem o supervisor libera (ex.: romaneio pago). */
  hardBlocked?: boolean;
}

export function DeleteManifestDialog({
  open,
  onOpenChange,
  manifest,
  onConfirm,
  canDelete,
  blockReason,
  completedCount,
  hardBlocked = false,
}: DeleteManifestDialogProps) {
  const [supervisorPassword, setSupervisorPassword] = useState("");
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  const handlePasswordChange = (value: string) => {
    setSupervisorPassword(value);
    setPasswordError("");
    setIsPasswordValid(false);
  };

  const validateSupervisorPassword = async () => {
    if (!supervisorPassword.trim()) {
      setPasswordError("Digite a senha do supervisor.");
      return false;
    }

    setIsValidating(true);
    setPasswordError("");

    try {
      const { data, error } = await supabase.functions.invoke('validate-supervisor', {
        body: {
          password: supervisorPassword,
          action: 'delete_manifest',
          manifestId: manifest?.id
        }
      });

      if (error) {
        console.error('Supervisor validation error:', error);
        setPasswordError("Não foi possível conferir a senha. Tente de novo.");
        setIsPasswordValid(false);
        return false;
      }

      if (data?.valid) {
        setIsPasswordValid(true);
        setPasswordError("");
        return true;
      } else {
        setPasswordError(data?.error || "Senha do supervisor incorreta.");
        setIsPasswordValid(false);
        return false;
      }
    } catch (err) {
      console.error('Supervisor validation exception:', err);
      setPasswordError("Sem conexão. Confira a internet e tente de novo.");
      setIsPasswordValid(false);
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirm = async () => {
    if (!manifest || hardBlocked) return;
    
    if (!canDelete) {
      const isValid = await validateSupervisorPassword();
      if (!isValid) return;
    }
    
    onConfirm(manifest.id);
    setSupervisorPassword("");
    setIsPasswordValid(false);
    setPasswordError("");
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setSupervisorPassword("");
      setIsPasswordValid(false);
      setPasswordError("");
    }
    onOpenChange(open);
  };

  if (!manifest) return null;

  const notes = manifest.deliveriesCount === 1 ? "1 nota" : `${manifest.deliveriesCount} notas`;
  const canSubmit = !hardBlocked && (canDelete || !!supervisorPassword.trim());

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {!canDelete && <Lock className="h-5 w-5 text-warning" aria-hidden="true" />}
            {canDelete ? `Excluir o romaneio ${manifest.id}?` : "Exclusão bloqueada"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {canDelete
              ? "As notas ainda não entregues voltam para pendente. As já entregues continuam entregues. Não dá para desfazer."
              : blockReason}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground">
              <Truck className="h-4 w-4" />
            </span>
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium text-foreground">{manifest.driverName}</p>
              <p className="text-muted-foreground">
                <span className="font-data">{manifest.driverPlate || "sem placa"}</span> · {notes}
              </p>
            </div>
          </div>

          {!canDelete && completedCount ? (
            <Alert variant="warning">
              <AlertTriangle aria-hidden="true" />
              <AlertDescription className="text-foreground">{completedCount} entrega(s) já têm baixa confirmada.</AlertDescription>
            </Alert>
          ) : null}

          {!canDelete && !hardBlocked && (
            <div className="space-y-1.5">
              <Label htmlFor="supervisor-password">Senha do supervisor</Label>
              <Input
                id="supervisor-password"
                type="password"
                autoComplete="off"
                placeholder="Digite a senha do supervisor"
                value={supervisorPassword}
                onChange={(e) => handlePasswordChange(e.target.value)}
                disabled={isValidating}
                aria-invalid={!!passwordError || undefined}
                aria-describedby={passwordError ? "supervisor-password-error" : "supervisor-password-hint"}
              />
              {passwordError ? (
                <p id="supervisor-password-error" className="text-sm font-medium text-destructive">
                  {passwordError}
                </p>
              ) : isPasswordValid ? (
                <p className="flex items-center gap-1.5 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Senha conferida
                </p>
              ) : (
                <p id="supervisor-password-hint" className="text-sm text-muted-foreground">
                  Peça a um supervisor para digitar a senha.
                </p>
              )}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isValidating}>{hardBlocked ? "Fechar" : "Cancelar"}</AlertDialogCancel>
          {!hardBlocked && (
            <AlertDialogAction
              onClick={(event) => {
                // Mantem aberto enquanto a senha e conferida.
                event.preventDefault();
                void handleConfirm();
              }}
              disabled={isValidating || !canSubmit}
              className={buttonVariants({ variant: "destructive" })}
            >
              {isValidating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
              {isValidating ? "Conferindo…" : "Excluir romaneio"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
