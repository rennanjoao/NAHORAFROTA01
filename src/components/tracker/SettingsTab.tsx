import { Card } from "@/components/ui/card";
import { brandAvatar } from "@/lib/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Phone, Mail, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface SettingsTabProps {
  driverName: string;
}

export function SettingsTab({ driverName }: SettingsTabProps) {
  const { user, profile, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/login";
  };

  const initials = driverName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-4">
      {/* Profile Card */}
      <Card className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={brandAvatar(profile?.avatar_url)} />
            <AvatarFallback className="text-lg bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-lg font-semibold">{driverName}</h2>
            <Badge variant="secondary" className="mt-1">
              Motorista
            </Badge>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{user?.email}</span>
          </div>
          
          {profile?.name && (
            <div className="flex items-center gap-3 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{profile.name}</span>
            </div>
          )}
        </div>
      </Card>

      {/* App Info */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Sobre o App</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Versão: 1.0.0</p>
          <p>© {new Date().getFullYear()} Na Hora Frota</p>
        </div>
      </Card>

      {/* Logout */}
      <Button
        variant="destructive"
        onClick={handleLogout}
        className="w-full gap-2"
        size="lg"
      >
        <LogOut className="h-4 w-4" />
        Sair da Conta
      </Button>
    </div>
  );
}
