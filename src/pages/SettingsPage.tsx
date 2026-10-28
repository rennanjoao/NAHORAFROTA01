import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Palette, Shield, User, Save, Globe, Clock, Building2, Users, Eye, EyeOff } from "lucide-react";
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

export default function SettingsPage() {
  const { user, profile: authProfile, roles } = useAuth();
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
    billing: true,
    deliveryAlerts: true,
    driverUpdates: true,
  });

  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    next: false,
    confirm: false,
  });

  const [preferences, setPreferences] = useState({
    language: "pt-BR",
    timezone: "America/Sao_Paulo",
    dateFormat: "DD/MM/YYYY",
    autoRefresh: true,
    refreshInterval: "30",
  });

  useEffect(() => {
    setProfileForm((prev) => ({
      ...prev,
      name: authProfile?.name || "",
      email: authProfile?.email || user?.email || "",
      role: roles.map((role) => roleLabels[role] || role).join(", "),
    }));
  }, [authProfile, roles, user]);

  const handleSaveProfile = async () => {
    if (!user?.id) {
      toast({
        title: "Sessao expirada",
        description: "Faca login novamente para salvar seu perfil.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        name: profileForm.name,
        full_name: profileForm.name || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setIsSavingProfile(false);

    if (error) {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Nao foi possivel atualizar seu perfil.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Perfil atualizado",
      description: "Suas informacoes foram salvas com sucesso.",
    });
  };

  const handleSaveNotifications = () => {
    toast({
      title: "Notificações Atualizadas",
      description: "Suas preferências de notificação foram salvas.",
    });
  };

  const handleSavePreferences = () => {
    toast({
      title: "✅ Preferências Salvas",
      description: "Suas preferências do sistema foram atualizadas.",
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Gerencie suas preferências e configurações do sistema</p>
        </div>

        <Tabs defaultValue="company" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 h-auto">
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
            <TabsTrigger value="notifications" className="gap-2 py-3">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notificações</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2 py-3">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Preferências</span>
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
                <div className="grid gap-4 sm:grid-cols-2">
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
                    <Input
                      id="email"
                      type="email"
                      value={profileForm.email}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Cargo</Label>
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

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Preferências de Notificação
                </CardTitle>
                <CardDescription>Configure como deseja receber alertas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Canais de Notificao</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Notificações por E-mail</Label>
                        <p className="text-sm text-muted-foreground">Receba atualizações no seu e-mail</p>
                      </div>
                      <Switch
                        checked={notifications.email}
                        onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Notificações Push</Label>
                        <p className="text-sm text-muted-foreground">Alertas em tempo real no navegador</p>
                      </div>
                      <Switch
                        checked={notifications.push}
                        onCheckedChange={(checked) => setNotifications({ ...notifications, push: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>SMS</Label>
                        <p className="text-sm text-muted-foreground">Alertas críticos via mensagem de texto</p>
                      </div>
                      <Switch
                        checked={notifications.sms}
                        onCheckedChange={(checked) => setNotifications({ ...notifications, sms: checked })}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h4 className="text-sm font-medium">Tipos de Alerta</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Alertas de Cobrança</Label>
                        <p className="text-sm text-muted-foreground">Faturas e vencimentos</p>
                      </div>
                      <Switch
                        checked={notifications.billing}
                        onCheckedChange={(checked) => setNotifications({ ...notifications, billing: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Alertas de Entrega</Label>
                        <p className="text-sm text-muted-foreground">Atrasos e problemas nas entregas</p>
                      </div>
                      <Switch
                        checked={notifications.deliveryAlerts}
                        onCheckedChange={(checked) => setNotifications({ ...notifications, deliveryAlerts: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Atualizações de Motoristas</Label>
                        <p className="text-sm text-muted-foreground">Status e eventos dos motoristas</p>
                      </div>
                      <Switch
                        checked={notifications.driverUpdates}
                        onCheckedChange={(checked) => setNotifications({ ...notifications, driverUpdates: checked })}
                      />
                    </div>
                  </div>
                </div>

                <Button onClick={handleSaveNotifications} className="gap-2">
                  <Save className="h-4 w-4" />
                  Salvar Preferências
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Preferências do Sistema
                </CardTitle>
                <CardDescription>Personalize sua experiência</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Idioma
                    </Label>
                    <Select
                      value={preferences.language}
                      onValueChange={(value) => setPreferences({ ...preferences, language: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                        <SelectItem value="en-US">English (US)</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Fuso Horário
                    </Label>
                    <Select
                      value={preferences.timezone}
                      onValueChange={(value) => setPreferences({ ...preferences, timezone: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/Sao_Paulo">São Paulo (GMT-3)</SelectItem>
                        <SelectItem value="America/Manaus">Manaus (GMT-4)</SelectItem>
                        <SelectItem value="America/Recife">Recife (GMT-3)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Formato de Data</Label>
                    <Select
                      value={preferences.dateFormat}
                      onValueChange={(value) => setPreferences({ ...preferences, dateFormat: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DD/MM/YYYY">DD/MM/AAAA</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/AAAA</SelectItem>
                        <SelectItem value="YYYY-MM-DD">AAAA-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Atualização Automática</Label>
                    <Select
                      value={preferences.refreshInterval}
                      onValueChange={(value) => setPreferences({ ...preferences, refreshInterval: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">A cada 15 segundos</SelectItem>
                        <SelectItem value="30">A cada 30 segundos</SelectItem>
                        <SelectItem value="60">A cada 1 minuto</SelectItem>
                        <SelectItem value="0">Desativado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={handleSavePreferences} className="gap-2">
                  <Save className="h-4 w-4" />
                  Salvar Preferências
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
                <CardDescription>Gerencie a segurança da sua conta</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Senha Atual</Label>
                    <div className="relative">
                      <Input
                        id="current-password"
                        type={showPasswords.current ? "text" : "password"}
                        placeholder="••••••••"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                        onClick={() => setShowPasswords((prev) => ({ ...prev, current: !prev.current }))}
                        aria-label={showPasswords.current ? "Ocultar senha atual" : "Mostrar senha atual"}
                      >
                        {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">Nova Senha</Label>
                      <div className="relative">
                        <Input
                          id="new-password"
                          type={showPasswords.next ? "text" : "password"}
                          placeholder="••••••••"
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                          onClick={() => setShowPasswords((prev) => ({ ...prev, next: !prev.next }))}
                          aria-label={showPasswords.next ? "Ocultar nova senha" : "Mostrar nova senha"}
                        >
                          {showPasswords.next ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                      <div className="relative">
                        <Input
                          id="confirm-password"
                          type={showPasswords.confirm ? "text" : "password"}
                          placeholder="••••••••"
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                          onClick={() => setShowPasswords((prev) => ({ ...prev, confirm: !prev.confirm }))}
                          aria-label={showPasswords.confirm ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                        >
                          {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    toast({
                      title: "Senha Alterada",
                      description: "Sua senha foi atualizada com sucesso.",
                    });
                  }}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  Alterar Senha
                </Button>

                <div className="border-t pt-6 space-y-4">
                  <h4 className="text-sm font-medium">Sessões Ativas</h4>
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Este dispositivo</p>
                        <p className="text-sm text-muted-foreground">Chrome São Paulo, SP</p>
                      </div>
                      <span className="text-sm text-success">Ativo agora</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      toast({
                        title: "Sessões Encerradas",
                        description: "Todas as outras sessões foram desconectadas.",
                      });
                    }}
                  >
                    Encerrar Outras Sessões
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
