import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, User, Save, Building2, Users, Eye, EyeOff, LogOut } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CompanySettingsTab } from "@/components/settings/CompanySettingsTab";
import { UserHierarchyTab } from "@/components/settings/UserHierarchyTab";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  fleet_manager: "Gestor de Frota",
  dispatcher: "Despachante",
  viewer: "Visualizador",
};

const MIN_PASSWORD_LENGTH = 8;

/** Navegador e sistema do aparelho atual, para a lista de sessoes. */
function describeThisDevice(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Navegador";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} • ${os}` : browser;
}

export default function SettingsPage() {
  const { user, profile: authProfile, roles } = useAuth();

  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSigningOutOthers, setIsSigningOutOthers] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    next: false,
    confirm: false,
  });

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

  const handleSaveProfile = async () => {
    if (!user?.id) {
      toast({
        title: "Sessão expirada",
        description: "Faça login novamente para salvar seu perfil.",
        variant: "destructive",
      });
      return;
    }

    if (!profileForm.name.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe seu nome completo.", variant: "destructive" });
      return;
    }

    setIsSavingProfile(true);
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
    setIsSavingProfile(false);

    if (error || metadataError) {
      toast({
        title: "Erro ao salvar",
        description: (error || metadataError)?.message || "Não foi possível atualizar seu perfil.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Perfil atualizado",
      description: "Suas informações foram salvas com sucesso.",
    });
  };

  // Antes o botao so mostrava "Senha alterada" sem mudar nada.
  const handleChangePassword = async () => {
    const email = user?.email;
    if (!email) {
      toast({ title: "Sessão expirada", description: "Faça login novamente.", variant: "destructive" });
      return;
    }
    if (!passwordForm.current) {
      toast({ title: "Informe a senha atual", variant: "destructive" });
      return;
    }
    if (passwordForm.next.length < MIN_PASSWORD_LENGTH) {
      toast({
        title: "Senha muito curta",
        description: `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
        variant: "destructive",
      });
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      toast({ title: "As senhas não conferem", description: "Repita a nova senha igual nos dois campos.", variant: "destructive" });
      return;
    }
    if (passwordForm.next === passwordForm.current) {
      toast({ title: "Escolha uma senha diferente da atual", variant: "destructive" });
      return;
    }

    setIsChangingPassword(true);
    try {
      // Confere a senha atual antes de trocar.
      const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: passwordForm.current });
      if (checkError) {
        toast({ title: "Senha atual incorreta", variant: "destructive" });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: passwordForm.next });
      if (error) {
        toast({ title: "Não foi possível alterar a senha", description: error.message, variant: "destructive" });
        return;
      }

      setPasswordForm({ current: "", next: "", confirm: "" });
      toast({ title: "Senha alterada", description: "Use a nova senha no próximo acesso." });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSignOutOthers = async () => {
    setIsSigningOutOthers(true);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setIsSigningOutOthers(false);
    if (error) {
      toast({ title: "Não foi possível encerrar as sessões", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Sessões encerradas",
      description: "Os outros aparelhos conectados a esta conta foram desconectados.",
    });
  };

  const passwordField = (
    id: string,
    label: string,
    key: keyof typeof passwordForm,
    autoComplete: string,
  ) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={showPasswords[key] ? "text" : "password"}
          placeholder="••••••••"
          className="pr-10"
          autoComplete={autoComplete}
          value={passwordForm[key]}
          onChange={(e) => setPasswordForm((prev) => ({ ...prev, [key]: e.target.value }))}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
          onClick={() => setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }))}
          aria-label={showPasswords[key] ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
        >
          {showPasswords[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Gerencie sua empresa, os usuários e a sua conta</p>
        </div>

        <Tabs defaultValue="company" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 h-auto">
            <TabsTrigger value="company" className="gap-2 py-3">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Empresa</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2 py-3">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Usuários</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2 py-3">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Perfil</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2 py-3">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Segurança</span>
            </TabsTrigger>
          </TabsList>

          {/* Company Tab */}
          <TabsContent value="company">
            <CompanySettingsTab />
          </TabsContent>

          {/* Users Tab: hierarquia de acesso */}
          <TabsContent value="users">
            <UserHierarchyTab />
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informações do Perfil
                </CardTitle>
                <CardDescription>Atualize suas informações pessoais</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" value={profileForm.email} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={profileForm.phone}
                      placeholder="(11) 99999-0000"
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Nível de acesso</Label>
                    <Input id="role" value={profileForm.role} disabled className="bg-muted" />
                  </div>
                </div>
                <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isSavingProfile ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Segurança da Conta
                </CardTitle>
                <CardDescription>Troque sua senha e desconecte outros aparelhos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {passwordField("current-password", "Senha Atual", "current", "current-password")}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {passwordField("new-password", "Nova Senha", "next", "new-password")}
                    {passwordField("confirm-password", "Confirmar Nova Senha", "confirm", "new-password")}
                  </div>
                  <p className="text-xs text-muted-foreground">Mínimo de {MIN_PASSWORD_LENGTH} caracteres.</p>
                </div>

                <Button onClick={handleChangePassword} disabled={isChangingPassword} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isChangingPassword ? "Alterando..." : "Alterar Senha"}
                </Button>

                <div className="border-t pt-6 space-y-4">
                  <h4 className="text-sm font-medium">Sessões</h4>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Este aparelho</p>
                        <p className="text-sm text-muted-foreground">{describeThisDevice()}</p>
                      </div>
                      <span className="text-sm text-success">Ativo agora</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-2 text-destructive hover:text-destructive"
                    onClick={handleSignOutOthers}
                    disabled={isSigningOutOthers}
                  >
                    <LogOut className="h-4 w-4" />
                    {isSigningOutOthers ? "Encerrando..." : "Encerrar Sessões em Outros Aparelhos"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
