import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Save, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PersonAvatar } from "@/components/admin/PersonAvatar";
import { FormField } from "@/components/patterns/FormField";
import { SettingsCard } from "./SettingsCard";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  fleet_manager: "Gestor de frota",
  dispatcher: "Despachante",
  viewer: "Visualizador",
};

const readOnlyClass = "bg-muted/50 text-muted-foreground hover:border-input focus-visible:border-input";

/** Configuracoes > Perfil: nome e telefone do usuario logado. */
export function ProfileSettings() {
  const { user, profile: authProfile, roles } = useAuth();
  const nameRef = useRef<HTMLInputElement>(null);

  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
  });
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    setProfileForm((prev) => ({
      ...prev,
      name: authProfile?.name || "",
      email: authProfile?.email || user?.email || "",
      // profiles nao tem telefone: fica nos dados do login
      phone: (user?.user_metadata?.phone as string | undefined) || "",
      role: roles.map((role) => roleLabels[role] || role).join(", "),
    }));
  }, [authProfile, roles, user]);

  const handleSaveProfile = async (event?: FormEvent) => {
    event?.preventDefault();
    // O botao continua focavel enquanto salva (aria-disabled): evita salvar duas vezes.
    if (isSavingProfile) return;
    if (!user?.id) {
      toast({
        title: "Sessão expirada",
        description: "Entre de novo para salvar seu perfil.",
        variant: "destructive",
      });
      return;
    }

    if (!profileForm.name.trim()) {
      setNameError("Digite seu nome completo.");
      nameRef.current?.focus();
      return;
    }

    setIsSavingProfile(true);
    let failed = false;
    try {
      const [{ error }, { error: metadataError }] = await Promise.all([
        supabase
          .from("profiles")
          .update({
            name: profileForm.name.trim(),
            full_name: profileForm.name.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id),
        // Antes o telefone era descartado ao salvar.
        supabase.auth.updateUser({ data: { name: profileForm.name.trim(), phone: profileForm.phone.trim() || null } }),
      ]);
      failed = !!(error || metadataError);
    } catch {
      // Sem internet o supabase pode lancar em vez de devolver o erro.
      failed = true;
    } finally {
      setIsSavingProfile(false);
    }

    if (failed) {
      toast({
        title: "Não foi possível salvar",
        description: "Confira a internet e tente de novo.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Perfil atualizado",
      description: "Suas informações foram salvas.",
      variant: "success",
    });
  };

  const displayName = profileForm.name || authProfile?.name || "Seu nome";

  return (
    <SettingsCard
      icon={UserRound}
      title="Perfil"
      description="Seu nome e telefone, do jeito que a equipe vê."
      onSubmit={handleSaveProfile}
      footerHint="As alterações valem em todos os aparelhos em que você entra."
      footer={
        <Button type="submit" aria-disabled={isSavingProfile || undefined} className="aria-disabled:pointer-events-none aria-disabled:opacity-60">
          {isSavingProfile ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
          {isSavingProfile ? "Salvando..." : "Salvar alterações"}
        </Button>
      }
    >
      <div className="mb-6 flex items-center gap-4 rounded-lg border bg-muted/30 p-4">
        <PersonAvatar name={displayName} className="h-12 w-12 text-base" />
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{displayName}</p>
          <p className="truncate text-sm text-muted-foreground">{profileForm.email}</p>
        </div>
        {profileForm.role && (
          <Badge variant="secondary" className="ml-auto hidden shrink-0 sm:inline-flex">
            {profileForm.role}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField id="name" label="Nome completo" error={nameError} hint="Aparece no menu, nos romaneios e para a equipe.">
          {(control) => (
            <Input
              {...control}
              ref={nameRef}
              autoComplete="name"
              value={profileForm.name}
              aria-required="true"
              onChange={(e) => {
                setProfileForm({ ...profileForm, name: e.target.value });
                if (nameError) setNameError(null);
              }}
            />
          )}
        </FormField>
        <FormField id="email" label="E-mail" hint="É o seu login. Só o administrador da empresa pode trocar.">
          {(control) => <Input {...control} type="email" value={profileForm.email} readOnly className={readOnlyClass} />}
        </FormField>
        <FormField id="phone" label="Telefone" optional hint="Para a equipe falar com você.">
          {(control) => (
            <Input
              {...control}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={profileForm.phone}
              placeholder="(11) 99999-0000"
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
            />
          )}
        </FormField>
        <FormField id="role" label="Nível de acesso" hint="Definido pelo administrador da empresa.">
          {(control) => <Input {...control} value={profileForm.role} readOnly className={readOnlyClass} />}
        </FormField>
      </div>
    </SettingsCard>
  );
}
