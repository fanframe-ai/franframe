import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SystemAlert {
  id: string;
  type: "error_spike" | "slow_processing" | "high_usage" | "api_error";
  message: string;
  severity: "info" | "warning" | "critical";
  resolved: boolean;
  created_at: string;
}

interface AlertsListProps {
  alerts: SystemAlert[];
  onResolve: (alertId: string) => void;
}

const severityConfig = {
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10" },
  warning: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10" },
  critical: { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" },
};

const typeLabels = {
  error_spike: "Pico de Erros",
  slow_processing: "Lentidão",
  high_usage: "Alto Uso",
  api_error: "Erro de API",
};

export function AlertsList({ alerts, onResolve }: AlertsListProps) {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
        <p className="text-lg font-medium">Tudo certo!</p>
        <p className="text-muted-foreground">Nenhum alerta ativo no momento</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const config = severityConfig[alert.severity];
        const Icon = config.icon;

        return (
          <div
            key={alert.id}
            className={`p-4 rounded-lg border border-border ${config.bg}`}
          >
            <div className="flex items-start gap-4">
              <div className={`p-2 rounded-lg ${config.bg}`}>
                <Icon className={`h-5 w-5 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    {typeLabels[alert.type]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(alert.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>
                <p className="text-sm">{alert.message}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onResolve(alert.id)}
              >
                Resolver
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
