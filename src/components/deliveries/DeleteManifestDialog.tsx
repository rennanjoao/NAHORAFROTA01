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
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Lock, Trash2, FileText, Truck, Loader2 } from "lucide-react";
import { ManifestRecord } from "@/stores/manifestStore";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface DeleteManifestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manifest: ManifestRecord | null;
  onConfirm: (manifestId: string) => void;
  canDelete: boolean;
  blockReason?: string;
  completedCount?: number;
}

export function DeleteManifestDialog({
  open,
  onOpenChange,
  manifest,
  onConfirm,
  canDelete,
  blockReason,
  completedCount,
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
      setPasswordError("Digite a senha de supervisor");
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
        setPasswordError("Erro ao validar senha. Tente novamente.");
        setIsPasswordValid(false);
        return false;
      }

      if (data?.valid) {
        setIsPasswordValid(true);
        setPasswordError("");
        return true;
      } else {
        setPasswordError(data?.error || "Senha de supervisor incorreta");
        setIsPasswordValid(false);
        return false;
      }
    } catch (err) {
      console.error('Supervisor validation exception:', err);
      setPasswordError("Erro de conexão. Tente novamente.");
      setIsPasswordValid(false);
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirm = async () => {
    if (!manifest) return;
    
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

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {canDelete ? (
              <Trash2 className="h-5 w-5 text-destructive" />
            ) : (
              <Lock className="h-5 w-5 text-warning" />
            )}
            {canDelete ? "Excluir Romaneio" : "Exclusão Bloqueada"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              {/* Manifest Info */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono font-semibold">{manifest.id}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Truck className="h-4 w-4" />
                  <span>{manifest.driverName}</span>
                  <span>•</span>
                  <span className="font-mono">{manifest.driverPlate}</span>
                </div>
                <div className="text-sm">
                  <Badge variant="secondary">{manifest.deliveriesCount} NFs</Badge>
                </div>
              </div>

              {canDelete ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    Tem certeza que deseja excluir o Romaneio{" "}
                    <strong className="font-mono">{manifest.id}</strong>?
                  </p>
                  <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
                    <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                    <p className="text-xs text-warning-foreground">
                      Todas as <strong>{manifest.deliveriesCount}</strong> notas fiscais deste romaneio voltarão para a lista de pendentes.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <div className="text-xs text-destructive">
                      <p className="font-semibold mb-1">Exclusão bloqueada:</p>
                      <p>{blockReason}</p>
                      {completedCount && (
                        <p className="mt-1">
                          {completedCount} entrega(s) já possui(em) baixa confirmada.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="supervisor-password" className="text-sm font-medium">
                      Senha de Supervisor
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Para excluir este romaneio, é necessária a senha de um supervisor.
                    </p>
                    <Input
                      id="supervisor-password"
                      type="password"
                      placeholder="Digite a senha de supervisor"
                      value={supervisorPassword}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      disabled={isValidating}
                      className={cn(
                        passwordError && "border-destructive",
                        isPasswordValid && "border-success"
                      )}
                    />
                    {passwordError && (
                      <p className="text-xs text-destructive">{passwordError}</p>
                    )}
                    {isPasswordValid && (
                      <p className="text-xs text-success">✓ Senha válida</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isValidating}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isValidating || (!canDelete && !supervisorPassword.trim())}
            className={cn(
              "gap-2",
              canDelete || supervisorPassword.trim()
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "opacity-50 cursor-not-allowed"
            )}
          >
            {isValidating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {isValidating ? "Validando..." : "Excluir Romaneio"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
