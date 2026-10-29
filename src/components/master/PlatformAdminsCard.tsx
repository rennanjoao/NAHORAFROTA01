import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog, EmptyState, ListSkeleton, Section } from "@/components/patterns";
import { PersonAvatar } from "@/components/admin/PersonAvatar";
import { FormField } from "@/components/patterns/FormField";
import { Crown, Plus, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface PlatformAdmin {
  user_id: string;
  created_at: string;
  name: string;
  email: string;
}

export function PlatformAdminsCard() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<PlatformAdmin | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchAdmins = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: platformAdmins, error } = await supabase
        .from("platform_admins")
        .select("user_id, created_at")
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (!platformAdmins || platformAdmins.length === 0) {
        setAdmins([]);
        setIsLoading(false);
        return;
      }

      const userIds = platformAdmins.map((a) => a.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.id, { name: p.name, email: p.email }])
      );

      const enriched: PlatformAdmin[] = platformAdmins.map((a) => ({
        user_id: a.user_id,
        created_at: a.created_at,
        name: profileMap.get(a.user_id)?.name || "—",
        email: profileMap.get(a.user_id)?.email || "—",
      }));

      setAdmins(enriched);
    } catch (err) {
      console.error("Error fetching platform admins:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const handleAdd = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!email.trim()) {
      setEmailError("Digite o e-mail de quem vai ter acesso.");
      document.getElementById("adminEmail")?.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Confira o e-mail. Exemplo: nome@empresa.com.br");
      document.getElementById("adminEmail")?.focus();
      return;
    }

    setAdding(true);
    try {
      // Find user by email in profiles
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, name, email")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        setEmailError("Nenhum usuário com esse e-mail está cadastrado no sistema.");
        return;
      }

      // Check if already admin
      const exists = admins.some((a) => a.user_id === profile.id);
      if (exists) {
        setEmailError("Esta pessoa já tem acesso ao Painel Master.");
        return;
      }

      const { error } = await supabase
        .from("platform_admins")
        .insert({ user_id: profile.id });

      if (error) throw error;

      toast({
        title: "Administrador adicionado",
        description: `${profile.name} agora tem acesso ao Painel Master.`,
        variant: "success",
      });

      setEmail("");
      setOpen(false);
      fetchAdmins();
    } catch (err) {
      console.error("Error adding platform admin:", err);
      toast({
        title: "Não foi possível adicionar",
        description: "Tente de novo em instantes.",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (adminUserId: string, adminName: string) => {
    try {
      const { error } = await supabase
        .from("platform_admins")
        .delete()
        .eq("user_id", adminUserId);

      if (error) throw error;

      toast({
        title: "Acesso removido",
        description: `${adminName} não tem mais acesso ao Painel Master.`,
      });

      setAdmins((prev) => prev.filter((a) => a.user_id !== adminUserId));
    } catch (err) {
      console.error("Error removing platform admin:", err);
      toast({
        title: "Não foi possível remover o acesso",
        description: "Tente de novo em instantes.",
        variant: "destructive",
      });
    }
  };

  const openChange = (next: boolean) => {
    if (next) {
      setEmail("");
      setEmailError(null);
    }
    setOpen(next);
  };

  return (
    <Section
      title="Administradores da plataforma"
      description="Pessoas com acesso a este Painel Master e a todas as empresas."
      actions={
        <Dialog open={open} onOpenChange={openChange}>
          <DialogTrigger asChild>
            <Button className="max-sm:w-full">
              <Plus aria-hidden="true" />
              Adicionar administrador
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar administrador da plataforma</DialogTitle>
              <DialogDescription>
                A pessoa precisa já ter uma conta no sistema. Ela passa a ver todas as empresas.
              </DialogDescription>
            </DialogHeader>
            <form id="platform-admin-form" onSubmit={handleAdd} noValidate>
              <FormField id="adminEmail" label="E-mail da pessoa" error={emailError}>
                {(control) => (
                  <Input
                    {...control}
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    placeholder="usuario@empresa.com"
                    disabled={adding}
                  />
                )}
              </FormField>
            </form>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={adding}>
                Cancelar
              </Button>
              <Button type="submit" form="platform-admin-form" disabled={adding}>
                {adding ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Crown aria-hidden="true" />}
                {adding ? "Adicionando..." : "Conceder acesso"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {isLoading ? (
        <ListSkeleton rows={2} />
      ) : admins.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nenhum administrador da plataforma"
          description="Adicione alguém da equipe Na Hora Frota para cuidar das empresas."
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card shadow-sm">
          {admins.map((admin) => {
            const isSelf = admin.user_id === user?.id;
            return (
              <li key={admin.user_id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <PersonAvatar name={admin.name} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    <span className="truncate">{admin.name}</span>
                    {isSelf && <Badge variant="outline">Você</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {admin.email}
                    <span className="hidden sm:inline"> · desde {new Date(admin.created_at).toLocaleDateString("pt-BR")}</span>
                  </p>
                </div>
                {!isSelf && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setToRemove(admin)}
                        aria-label={`Remover acesso de ${admin.name}`}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remover acesso</TooltipContent>
                  </Tooltip>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={(next) => !next && !removing && setToRemove(null)}
        title={`Remover o acesso de ${toRemove?.name ?? "administrador"}?`}
        description="A pessoa perde o acesso ao Painel Master. Você pode adicionar de novo depois."
        confirmLabel="Remover acesso"
        tone="danger"
        loading={removing}
        onConfirm={async () => {
          if (!toRemove) return;
          setRemoving(true);
          try {
            await handleRemove(toRemove.user_id, toRemove.name);
          } finally {
            setRemoving(false);
            setToRemove(null);
          }
        }}
      />
    </Section>
  );
}
