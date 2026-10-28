import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Building2, 
  AlertCircle,
  ChevronRight,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TopRoute {
  rank: number;
  name: string;
  delays: number;
  trend: number;
}

interface TopClient {
  rank: number;
  name: string;
  returns: number;
  trend: number;
}

interface TopReason {
  rank: number;
  reason: string;
  count: number;
  percentage: number;
}

interface TopOffendersData {
  routes: TopRoute[];
  clients: TopClient[];
  reasons: TopReason[];
}

interface TopOffendersProps {
  data: TopOffendersData;
  onRouteClick?: (route: string) => void;
  onClientClick?: (client: string) => void;
}

export function TopOffenders({ data, onRouteClick, onClientClick }: TopOffendersProps) {
  const getRankBadge = (rank: number) => {
    const colors = {
      1: "bg-destructive text-destructive-foreground",
      2: "bg-orange-500 text-white",
      3: "bg-warning text-warning-foreground",
    };
    return colors[rank as keyof typeof colors] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <h3 className="font-semibold text-lg">Análise Crítica - Top Ofensores</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top 5 Routes with Delays */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-4 w-4 text-primary" />
            <h4 className="font-medium">Top 5 Rotas com Atraso</h4>
          </div>
          <div className="space-y-3">
            {data.routes.map((route) => (
              <div
                key={route.rank}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                onClick={() => onRouteClick?.(route.name)}
              >
                <Badge className={cn("w-6 h-6 p-0 justify-center text-xs", getRankBadge(route.rank))}>
                  {route.rank}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{route.name}</p>
                  <p className="text-xs text-muted-foreground">{route.delays} atrasos</p>
                </div>
                <div className="flex items-center gap-1">
                  {route.trend > 0 ? (
                    <TrendingUp className="h-3 w-3 text-destructive" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-success" />
                  )}
                  <span className={cn(
                    "text-xs font-medium",
                    route.trend > 0 ? "text-destructive" : "text-success"
                  )}>
                    {route.trend > 0 ? "+" : ""}{route.trend}%
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </Card>

        {/* Top 5 Clients with Returns */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-4 w-4 text-primary" />
            <h4 className="font-medium">Top 5 Clientes com Devolução</h4>
          </div>
          <div className="space-y-3">
            {data.clients.map((client) => (
              <div
                key={client.rank}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                onClick={() => onClientClick?.(client.name)}
              >
                <Badge className={cn("w-6 h-6 p-0 justify-center text-xs", getRankBadge(client.rank))}>
                  {client.rank}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{client.name}</p>
                  <p className="text-xs text-muted-foreground">{client.returns} devoluções</p>
                </div>
                <div className="flex items-center gap-1">
                  {client.trend > 0 ? (
                    <TrendingUp className="h-3 w-3 text-destructive" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-success" />
                  )}
                  <span className={cn(
                    "text-xs font-medium",
                    client.trend > 0 ? "text-destructive" : "text-success"
                  )}>
                    {client.trend > 0 ? "+" : ""}{client.trend}%
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </Card>

        {/* Top 5 Occurrence Reasons */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-4 w-4 text-primary" />
            <h4 className="font-medium">Top 5 Motivos de Ocorrência</h4>
          </div>
          <div className="space-y-3">
            {data.reasons.map((reason) => (
              <div
                key={reason.rank}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Badge className={cn("w-6 h-6 p-0 justify-center text-xs", getRankBadge(reason.rank))}>
                  {reason.rank}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{reason.reason}</p>
                  <p className="text-xs text-muted-foreground">{reason.count} ocorrências</p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {reason.percentage.toFixed(1)}%
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
