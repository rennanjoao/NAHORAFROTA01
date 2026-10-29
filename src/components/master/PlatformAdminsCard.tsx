import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
    } catch (err: any) {
      console.error("Error fetching platform admins:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const handleAdd = async () => {
    if (!email.trim()) {
      toast({ title: "E-mail obrigatório", variant: "destructive" });
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
        toast({
          title: "Usuário não encontrado",
          description: "Nenhum usuário com esse e-mail está cadastrado no sistema.",
          variant: "destructive",
        });
        return;
      }

      // Check if already admin
      const exists = admins.some((a) => a.user_id === profile.id);
      if (exists) {
        toast({
          title: "Já é Platform Admin",
          description: "Este usuário já possui acesso Master.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("platform_admins")
        .insert({ user_id: profile.id });

      if (error) throw error;

      toast({
        title: "✅ Platform Admin adicionado",
        description: `${profile.name} agora tem acesso ao Painel Master.`,
      });

      setEmail("");
      setOpen(false);
      fetchAdmins();
    } catch (err: any) {
      console.error("Error adding platform admin:", err);
      toast({
        title: "Erro ao adicionar",
        description: err.message,
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
        title: "🗑️ Acesso removido",
        description: `${adminName} não tem mais acesso ao Painel Master.`,
      });

      setAdmins((prev) => prev.filter((a) => a.user_id !== adminUserId));
    } catch (err: any) {
      console.error("Error removing platform admin:", err);
      toast({
        title: "Erro ao remover",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-amber-400" />
          Administradores da Plataforma
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-400" />
                Adicionar Platform Admin
              </DialogTitle>
              <DialogDescription>
                Informe o e-mail de um usuário já cadastrado no sistema para conceder acesso Master.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="adminEmail">E-mail do Usuário</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                  disabled={adding}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={adding}>
                Cancelar
              </Button>
              <Button onClick={handleAdd} disabled={adding} className="gap-2">
                {adding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  <>
                    <Crown className="h-4 w-4" />
                    Conceder Acesso
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : admins.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">
            Nenhum administrador da plataforma configurado.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.user_id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-400" />
                    {admin.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{admin.email}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(admin.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    {admin.user_id === user?.id ? (
                      <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                        Você
                      </Badge>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover {admin.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Este usuário perderá o acesso ao Painel Master. Essa ação pode ser revertida adicionando novamente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground"
                              onClick={() => handleRemove(admin.user_id, admin.name)}
                            >
                              Remover Acesso
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
