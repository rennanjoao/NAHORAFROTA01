import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  CreditCard,
  Users,
  Crown,
  Check,
  Download,
  QrCode,
  Trash2,
  Loader2,
  RefreshCw,
  UserPlus,
  Truck,
  Pencil,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CreateDriverModal } from "@/components/admin/CreateDriverModal";
import { InviteUserDialog } from "@/components/admin/InviteUserDialog";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { useSystemUsers, SystemUser } from "@/hooks/useSystemUsers";
import { useDriversDB } from "@/hooks/useDriversDB";
import { EditAccessDialog } from "@/components/admin/EditAccessDialog";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { PlanLimitBanner } from "@/components/plan/PlanLimitBanner";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";

const planFeatures = [
  "Até 50 motoristas cadastrados",
  "Rastreamento em tempo real",
  "Romaneios ilimitados",
  "Relatórios avançados",
  "Integração WhatsApp",
  "Suporte prioritário",
];

const roleConfig: Record<string, { label: string; className: string }> = {
  admin: { label: "Administrador", className: "bg-destructive text-destructive-foreground" },
  fleet_manager: { label: "Gestor de Frota", className: "bg-primary text-primary-foreground" },
  dispatcher: { label: "Despachante", className: "bg-info text-info-foreground" },
  viewer: { label: "Visualizador", className: "bg-muted text-muted-foreground" },
};

export default function AdminPage() {
  const { user } = useAuth();
  const { users, isLoading, error, refetch, updateUserRole, deleteUser, roleLabels } = useSystemUsers();
  const {
    drivers,
    isLoading: isLoadingDrivers,
    error: driversError,
    fetchDrivers,
  } = useDriversDB();
  const {
    canAddUser,
    canAddDriver,
    systemUsersCount,
    driversCount,
    limits,
    plan,
    planLabels: pLabels,
    isLoading: planLimitsLoading,
  } = usePlanLimits();
  const [showQrCode, setShowQrCode] = useState(false);
  const { status: subscriptionStatus, daysRemaining, access } = useSubscriptionStatus();
  const isTrial = subscriptionStatus === "trial";
  const planBadge = isTrial
    ? { label: "Teste grátis", className: "bg-primary text-primary-foreground" }
    : subscriptionStatus === "expired"
      ? { label: "Vencido", className: "bg-destructive text-destructive-foreground" }
      : subscriptionStatus === "due_today" || subscriptionStatus === "warning"
        ? { label: "Vencendo", className: "bg-warning text-warning-foreground" }
        : { label: "Ativo", className: "bg-success text-success-foreground" };
  const formatDate = (value?: string | null) =>
    value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString("pt-BR") : null;
  const billingLine = isTrial
    ? `Teste grátis até ${formatDate(access?.trial_ends_at) ?? "—"} (${daysRemaining <= 0 ? "termina hoje" : `${daysRemaining} dia(s) restante(s)`})`
    : formatDate(access?.next_due_date)
      ? `Próxima cobrança: ${formatDate(access?.next_due_date)}`
      : "Próxima cobrança: a definir com a equipe NaHora Frota";
  const [editTarget, setEditTarget] = useState<
    | { type: "user"; record: SystemUser }
    | { type: "driver"; record: (typeof drivers)[number] }
    | null
  >(null);

  const refreshAdminLists = async () => {
    await Promise.all([refetch(), fetchDrivers()]);
  };

  const handleGenerateBoleto = () => {
    toast({
      title: "📄 Boleto Gerado",
      description: "O boleto foi gerado e o download iniciará em instantes.",
    });
    
    // Simulate download
    setTimeout(() => {
      const content = `BOLETO BANCÁRIO - NA HORA TRANSPORTE
=====================================
Valor: R$ 299,00
Vencimento: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR")}
Código de Barras: 23793.38128 60000.000003 00000.000400 1 98290000029900

Pague este boleto em qualquer banco ou casa lotérica.`;
      
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "boleto-nahora.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);
  };

  const handlePayPix = () => {
    setShowQrCode(true);
    toast({
      title: "📱 PIX Gerado",
      description: "Escaneie o QR Code para realizar o pagamento.",
    });
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    // Prevent deleting yourself
    if (userId === user?.id) {
      toast({
        title: "Ação não permitida",
        description: "Você não pode remover seu próprio usuário.",
        variant: "destructive",
      });
      return;
    }

    // Check if it's the last admin
    const admins = users.filter(u => u.role === 'admin');
    const targetUser = users.find(u => u.user_id === userId);
    if (targetUser?.role === 'admin' && admins.length <= 1) {
      toast({
        title: "Ação não permitida",
        description: "Não é possível remover o último administrador.",
        variant: "destructive",
      });
      return;
    }

    await deleteUser(userId);
  };

  const handleRoleChange = async (userId: string, newRole: SystemUser['role']) => {
    await updateUserRole(userId, newRole);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            Área Administrativa
          </h1>
          <p className="text-muted-foreground">Gerenciamento de planos, pagamentos e usuários</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="plans" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Planos e Pagamentos
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Gestão de Usuários
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Plans & Payments */}
          <TabsContent value="plans" className="space-y-6">
            {/* Current Plan */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary">
                      <Crown className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <CardTitle>Plano Profissional</CardTitle>
                      <CardDescription>Seu plano atual</CardDescription>
                    </div>
                  </div>
                  <Badge className={planBadge.className}>{planBadge.label}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-3xl font-bold text-foreground">
                      R$ 299,00<span className="text-base font-normal text-muted-foreground">/mês</span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {billingLine}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {planFeatures.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-success" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <div className="grid md:grid-cols-3 gap-4">
              {/* Credit Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Cartão de Crédito
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cardHolder">Nome no Cartão</Label>
                    <Input id="cardHolder" placeholder="JOÃO M SILVA" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">Número do Cartão</Label>
                    <Input id="cardNumber" placeholder="0000 0000 0000 0000" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="expiry">Validade</Label>
                      <Input id="expiry" placeholder="MM/AA" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cvv">CVV</Label>
                      <Input id="cvv" placeholder="123" type="password" />
                    </div>
                  </div>
                  <Button className="w-full">Salvar Cartão</Button>
                </CardContent>
              </Card>

              {/* Boleto */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Download className="h-5 w-5 text-primary" />
                    Boleto Bancário
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Gere um boleto para pagamento da sua mensalidade. O boleto tem vencimento em 7 dias.
                  </p>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-2xl font-bold text-foreground">R$ 299,00</p>
                    <p className="text-xs text-muted-foreground">Valor da mensalidade</p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full gap-2"
                    onClick={handleGenerateBoleto}
                  >
                    <Download className="h-4 w-4" />
                    Gerar Boleto
                  </Button>
                </CardContent>
              </Card>

              {/* PIX */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <QrCode className="h-5 w-5 text-primary" />
                    PIX
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Pague instantaneamente via PIX escaneando o QR Code.
                  </p>
                  
                  {showQrCode ? (
                    <div className="p-4 rounded-lg bg-white border text-center">
                      {/* Mock QR Code */}
                      <div className="mx-auto w-32 h-32 bg-foreground rounded-lg flex items-center justify-center mb-2 relative overflow-hidden">
                        <div className="absolute inset-2 bg-white grid grid-cols-8 grid-rows-8 gap-0.5">
                          {Array.from({ length: 64 }).map((_, i) => (
                            <div 
                              key={i} 
                              className={cn(
                                "w-full h-full",
                                Math.random() > 0.5 ? "bg-foreground" : "bg-white"
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Escaneie com seu app de banco
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Clique para gerar o QR Code
                      </p>
                    </div>
                  )}
                  
                  <Button 
                    className="w-full gap-2 bg-[#32BCAD] hover:bg-[#2aa89a]"
                    onClick={handlePayPix}
                  >
                    <QrCode className="h-4 w-4" />
                    Pagar com PIX
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 2: User Management */}
          <TabsContent value="users" className="space-y-6">
            {/* Plan Limit Banner */}
            {!planLimitsLoading && (
              <PlanLimitBanner
                plan={plan}
                resourceLabel="usuários de sistema"
                currentCount={systemUsersCount}
                maxCount={limits.max_users}
                planLabels={pLabels}
              />
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-semibold">Usuários do Sistema</h2>
                <p className="text-sm text-muted-foreground">
                  {isLoading ? "Carregando..." : `${users.length} usuário(s) cadastrado(s)`}
                  {limits.max_users !== -1 && ` • Limite de Painel: ${systemUsersCount}/${limits.max_users}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={refetch}
                  disabled={isLoading}
                >
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                </Button>
                <CreateUserDialog onUserCreated={refetch} />
                <InviteUserDialog onUserInvited={refetch} />
                {canAddDriver ? (
                  <CreateDriverModal onUserCreated={refreshAdminLists} />
                ) : (
                  <Button disabled className="gap-2 opacity-50">
                    <UserPlus className="h-4 w-4" />
                    Limite de Motoristas atingido
                  </Button>
                )}
              </div>
            </div>

            {/* Error State */}
            {error && (
              <Card className="border-destructive/50 bg-destructive/10">
                <CardContent className="pt-6">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button variant="outline" size="sm" onClick={refetch} className="mt-2">
                    Tentar novamente
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Users Table */}
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2 text-muted-foreground">Carregando usuários...</span>
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum usuário cadastrado</p>
                    <p className="text-sm">Clique em "Criar Usuário" para adicionar</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Permissão</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((systemUser) => {
                        const config = roleConfig[systemUser.role] || roleConfig.viewer;
                        const isCurrentUser = systemUser.user_id === user?.id;
                        
                        return (
                          <TableRow key={systemUser.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                                  {systemUser.avatar_url ? (
                                    <img 
                                      src={systemUser.avatar_url} 
                                      alt={systemUser.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-sm font-semibold text-primary">
                                      {systemUser.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium flex items-center gap-2">
                                    {systemUser.name}
                                    {isCurrentUser && (
                                      <Badge variant="outline" className="text-xs">Você</Badge>
                                    )}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{systemUser.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={systemUser.role}
                                onValueChange={(value) => handleRoleChange(systemUser.user_id, value as SystemUser['role'])}
                                disabled={isCurrentUser}
                              >
                                <SelectTrigger className="w-[160px]">
                                  <SelectValue>
                                    <Badge className={config.className}>{config.label}</Badge>
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(roleConfig).map(([value, cfg]) => (
                                    <SelectItem key={value} value={value}>
                                      <Badge className={cfg.className}>{cfg.label}</Badge>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(systemUser.created_at).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditTarget({ type: "user", record: systemUser })}
                                title="Editar usuário"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleDeleteUser(systemUser.user_id, systemUser.name)}
                                disabled={isCurrentUser}
                                title={isCurrentUser ? "Você não pode remover seu próprio usuário" : "Remover usuário"}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Drivers Table */}
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  Motoristas do App
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isLoadingDrivers ? "Carregando..." : `${drivers.length} motorista(s) cadastrado(s)`}
                  {limits.max_drivers !== -1 && ` • Limite de Motoristas: ${driversCount}/${limits.max_drivers}`}
                </p>
              </div>

              {driversError && (
                <Card className="border-destructive/50 bg-destructive/10">
                  <CardContent className="pt-6">
                    <p className="text-sm text-destructive">{driversError}</p>
                    <Button variant="outline" size="sm" onClick={fetchDrivers} className="mt-2">
                      Tentar novamente
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-0">
                  {isLoadingDrivers ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="ml-2 text-muted-foreground">Carregando motoristas...</span>
                    </div>
                  ) : drivers.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum motorista cadastrado</p>
                      <p className="text-sm">Clique em "Criar Motorista" para adicionar</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Motorista</TableHead>
                          <TableHead>Veículo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Criado em</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drivers.map((driver) => (
                          <TableRow key={driver.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                                  {driver.avatar || driver.photo ? (
                                    <img
                                      src={driver.avatar || driver.photo}
                                      alt={driver.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-sm font-semibold text-primary">
                                      {driver.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium">{driver.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {driver.email || driver.cpf}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{driver.vehicle_type || "Veículo"}</p>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {driver.vehicle_plate || "-"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {driver.status === "active"
                                  ? "Disponível"
                                  : driver.status === "in_route"
                                    ? "Em Rota"
                                    : driver.status === "inactive"
                                      ? "Inativo"
                                      : driver.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(driver.created_at).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditTarget({ type: "driver", record: driver })}
                                disabled={!driver.user_id}
                                title={driver.user_id ? "Editar motorista" : "Motorista sem login vinculado"}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <EditAccessDialog
        target={editTarget}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onSaved={refreshAdminLists}
      />
    </AppLayout>
  );
}
