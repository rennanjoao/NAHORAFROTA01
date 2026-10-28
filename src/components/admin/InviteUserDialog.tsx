import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mail, Loader2, Copy, Check, Shield, Lock, Crown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePlanLimits } from "@/hooks/usePlanLimits";

const ROLES = [
  { value: "dispatcher", label: "Despachante", description: "Importa notas e cria romaneios" },
  { value: "fleet_manager", label: "Gestor de Frota", description: "Gerencia motoristas e frota" },
  { value: "admin", label: "Administrador", description: "Acesso total ao sistema" },
] as const;

interface InviteUserDialogProps {
  onUserInvited?: () => void;
}

export function InviteUserDialog({ onUserInvited }: InviteUserDialogProps) {
  const { canAddUser, systemUsersCount, limits, plan, planLabels } = usePlanLimits();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("dispatcher");

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setName("");
      setEmail("");
      setRole("dispatcher");
      setInviteResult(null);
      setCopied(false);
    }
    setOpen(newOpen);
  };

  const handleInvite = async () => {
    if (!canAddUser) {
      toast.error(`Limite de ${limits.max_users} usuário(s) de sistema atingido no Plano ${planLabels[plan] || plan}. Faça upgrade.`);
      return;
    }

    if (!name.trim() || !email.trim()) {
      toast.error("Nome e e-mail são obrigatórios");
      return;
    }

    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("invite-user", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        body: { email: email.trim().toLowerCase(), name: name.trim(), role },
      });

      if (error) {
        console.error("Invite error:", error);
        toast.error(error.message || "Erro ao convidar usuário");
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || "Erro ao convidar usuário");
        return;
      }

      setInviteResult({ email: data.user.email, tempPassword: data.tempPassword });
      toast.success(`Convite criado para ${data.user.email}!`);
      onUserInvited?.();
    } catch (err: any) {
      console.error("Error inviting:", err);
      toast.error(err.message || "Erro ao convidar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCredentials = async () => {
    if (!inviteResult) return;
    const text = `Acesso ao NaHora Frota:\nE-mail: ${inviteResult.email}\nSenha temporária: ${inviteResult.tempPassword}\n\nAcesse: ${window.location.origin}/login`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Credenciais copiadas!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={!canAddUser}>
          {!canAddUser ? (
            <>
              <Lock className="h-4 w-4" />
              Limite de Usuários
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" />
              Convidar Usuário
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Convidar Usuário
          </DialogTitle>
          <DialogDescription>
            Envie um convite para um colaborador acessar o sistema
          </DialogDescription>
        </DialogHeader>

        {inviteResult ? (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-success/30 bg-success/10 p-4 space-y-3">
              <p className="font-semibold text-success flex items-center gap-2">
                <Check className="h-5 w-5" />
                Convite criado com sucesso!
              </p>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">E-mail:</span>{" "}
                  <span className="font-mono font-medium">{inviteResult.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Senha temporária:</span>{" "}
                  <span className="font-mono font-medium">{inviteResult.tempPassword}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Compartilhe essas credenciais com o usuário convidado. Ele deve trocar a senha no primeiro acesso.
              </p>
            </div>
            <Button onClick={handleCopyCredentials} className="w-full gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado!" : "Copiar Credenciais"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="inviteName">Nome Completo *</Label>
              <Input
                id="inviteName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do colaborador"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inviteEmail">E-mail *</Label>
              <Input
                id="inviteEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colaborador@empresa.com.br"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inviteRole">Nível de Acesso</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <div>
                          <span className="font-medium">{r.label}</span>
                          <span className="text-muted-foreground ml-2 text-xs">— {r.description}</span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          {inviteResult ? (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Fechar
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button onClick={handleInvite} disabled={isLoading} className="gap-2">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Convidando...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Enviar Convite
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
