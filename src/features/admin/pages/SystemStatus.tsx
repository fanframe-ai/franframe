import { useState, useEffect, useCallback, useRef } from "react";
import { AdminLayout } from "@/features/admin/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  RefreshCw,
  Loader2,
  Database,
  Cpu,
  Globe,
  Image,
  Server,
  Wifi,
  Activity,
  Trash2
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { overallStatus as calculateOverallStatus, currentStatus, buildAggregatedHistory, toIncident, type StatusSnapshot, type ServiceStatus, type DayStatus, type Incident } from "@/features/admin/status-model";
import { reportError } from '@/lib/diagnostics';
import { invoke } from '@/integrations/supabase/functions';
import { ptBR } from "date-fns/locale";

interface ServiceHealth {
  id: string;
  name: string;
  description: string;
  status: ServiceStatus;
  responseTime?: number;
  lastChecked: Date | null;
  icon: React.ReactNode;
  uptime: number | null;
  samples: number;
  error?: string;
}

const statusConfig: Record<ServiceStatus, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  operational: { 
    label: "Operacional", 
    color: "text-success", 
    bgColor: "bg-success/10",
    icon: <CheckCircle2 className="h-5 w-5" />
  },
  degraded: { 
    label: "Disponível com restrições",
    color: "text-warning", 
    bgColor: "bg-warning/10",
    icon: <AlertTriangle className="h-5 w-5" />
  },
  partial_outage: { 
    label: "Interrupção Parcial", 
    color: "text-orange-500", 
    bgColor: "bg-orange-500/10",
    icon: <AlertTriangle className="h-5 w-5" />
  },
  major_outage: { 
    label: "Fora do Ar", 
    color: "text-destructive", 
    bgColor: "bg-destructive/10",
    icon: <XCircle className="h-5 w-5" />
  },
  checking: { 
    label: "Verificando...", 
    color: "text-muted-foreground", 
    bgColor: "bg-muted/10",
    icon: <Loader2 className="h-5 w-5 animate-spin" />
  },
  unknown: { 
    label: "Sem confirmação recente",
    color: "text-muted-foreground", 
    bgColor: "bg-muted/10",
    icon: <Clock className="h-5 w-5" />
  },
};

const incidentStatusConfig = {
  investigating: { label: "Investigando", color: "text-destructive", bgColor: "bg-destructive/10" },
  identified: { label: "Identificado", color: "text-warning", bgColor: "bg-warning/10" },
  monitoring: { label: "Monitorando", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  resolved: { label: "Resolvido", color: "text-success", bgColor: "bg-success/10" },
};

const serviceIcons: Record<string, React.ReactNode> = {
  database: <Database className="h-5 w-5" />,
  auth: <Server className="h-5 w-5" />,
  "edge-functions": <Cpu className="h-5 w-5" />,
  realtime: <Wifi className="h-5 w-5" />,
  replicate: <Image className="h-5 w-5" />,
  cdn: <Globe className="h-5 w-5" />,
};

export default function AdminSystemStatus() {
  const { toast } = useToast();
  const [observations, setServices] = useState<ServiceHealth[]>([]);
  const [uptimeHistory, setUptimeHistory] = useState<Record<string, DayStatus[]>>({});
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const [lastFullCheck, setLastFullCheck] = useState<Date | null>(null);
  const [now, setNow] = useState(Date.now());
  const [readError, setReadError] = useState(false);
  const [incidentReadError, setIncidentReadError] = useState(false);
  const refreshing = useRef<Promise<void> | null>(null);
  const [isClearingHistory, setIsClearingHistory] = useState(false);

  const fetchHealthData = useCallback(async (force = false) => {
    if (refreshing.current) { await refreshing.current; if (!force) return; }
    const work = async () => {
      const cancellation = new AbortController();
      const deadline = setTimeout(() => cancellation.abort(), 15000);
      try {
      const { data, error } = await supabase.rpc('system_status_snapshot').abortSignal(cancellation.signal);
      if (error) throw error;
      const snapshot = data as unknown as StatusSnapshot;
      if (!snapshot || !Array.isArray(snapshot.latest) || !Array.isArray(snapshot.stats) || !Array.isArray(snapshot.days)) throw new Error('invalid_status_snapshot');
      const serviceMap = new Map(snapshot.latest.map(check => [check.service_id,check]));
      const statsMap = new Map(snapshot.stats.map(stat => [stat.service_id,stat]));

      // Build services list
      const serviceDefinitions = [
        { id: "database", name: "Banco de Dados", description: "Consulta autenticada de leitura" },
        { id: "auth", name: "Autenticação", description: "Resposta da API administrativa de Auth" },
        { id: "edge-functions", name: "Funções de Backend", description: "Resposta validada da rota de status" },
        { id: "realtime", name: "Tempo Real", description: "Abertura de conexão WebSocket" },
        { id: "replicate", name: "API IA", description: "API da conta configurada; sem geração paga" },
        { id: "cdn", name: "CDN / Assets", description: "Leitura de uma referência pública ativa" },
      ];

      const builtServices: ServiceHealth[] = serviceDefinitions.map(def => {
        const latest = serviceMap.get(def.id);
        const stats = statsMap.get(def.id);
        
        return {
          id: def.id,
          name: def.name,
          description: def.description,
          status: latest?.status as ServiceStatus || 'unknown',
          responseTime: latest?.response_time_ms ?? undefined,
          lastChecked: latest && Number.isFinite(Date.parse(latest.created_at)) ? new Date(latest.created_at) : null,
          icon: serviceIcons[def.id] || <Server className="h-5 w-5" />,
          uptime: stats?.availability ?? null,
          samples: stats?.checked ?? 0,
          error: latest?.error_message || undefined,
        };
      });

      setServices(builtServices);
      setNow(Date.now()); setReadError(false);
      setLastFullCheck(builtServices.every(service => service.lastChecked && Number.isFinite(service.lastChecked.getTime())) ? new Date(Math.min(...builtServices.map(service => service.lastChecked!.getTime()))) : null);
      setUptimeHistory(buildAggregatedHistory(serviceDefinitions.map(def => def.id), snapshot.days));

      // Fetch active incidents from system_alerts
      const { data: alerts, error: alertsError } = await supabase
        .from("system_alerts")
        .select("*")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(10).abortSignal(cancellation.signal);

      if (alertsError) {
        reportError('status_incidents_read_failed', alertsError);
      }
      setIncidentReadError(Boolean(alertsError));
      setIncidents((alerts || []).map(toIncident));

    } catch (err) {
      reportError('status_snapshot_failed', err); setReadError(true);
    } finally {
      clearTimeout(deadline);
      setIsLoading(false);
    } };
    refreshing.current = work();
    try { await refreshing.current; } finally { refreshing.current = null; }
  }, []);

  const services = observations.map(service => {
    const status = readError ? 'unknown' : currentStatus(service.status, service.lastChecked?.toISOString(), now);
    return { ...service, status, error: status === 'unknown' && service.status !== 'unknown' ? undefined : service.error };
  });
  const overallStatus = isLoading ? 'checking' : readError ? 'unknown' : calculateOverallStatus(services.map(service => service.status));

  const runHealthCheck = async () => {
    setIsRunningCheck(true);
    
    try {
      const result = await invoke<{ success: boolean; persisted: boolean }>('health-check', {});
      if (!result.success || !result.persisted) throw new Error('health_check_not_saved');
      await fetchHealthData(true);
    } catch (err) {
      reportError('manual_health_check_failed', err);
      toast({ title: 'Não foi possível concluir a verificação', description: 'O status anterior não confirma a saúde atual.', variant: 'destructive' });
    } finally {
      setIsRunningCheck(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    const refresh = () => { setNow(Date.now()); if (!document.hidden) void fetchHealthData(); };
    const interval = setInterval(refresh, 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', refresh); };
  }, [fetchHealthData]);

  const clearHistoricalData = async () => {
    if (!confirm("Tem certeza que deseja limpar todo o histórico de health checks? Esta ação não pode ser desfeita.")) {
      return;
    }
    
    setIsClearingHistory(true);
    
    try {
      const { error } = await supabase
        .from("health_checks")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all records
      
      if (error) throw error;
      
      toast({ title: "Histórico limpo com sucesso! Execute uma verificação para reiniciar o monitoramento." });
      await fetchHealthData();
    } catch (err) {
      reportError('health_history_clear_failed', err);
      toast({ title: "Erro ao limpar histórico. Verifique suas permissões.", variant: "destructive" });
    } finally {
      setIsClearingHistory(false);
    }
  };

  const getOverallStatusMessage = () => {
    switch (overallStatus) {
      case "operational":
        return "Todos os serviços verificados estão acessíveis";
      case "degraded":
        return "Há serviços disponíveis com restrições";
      case "partial_outage":
        return "Interrupção parcial detectada";
      case "major_outage":
        return "Sistemas fora do ar";
      case "unknown":
        return "Status sem confirmação recente";
      default:
        return "Verificando status...";
    }
  };

  const getStatusBarColor = (status: ServiceStatus) => {
    switch (status) {
      case "operational":
        return "bg-success";
      case "degraded":
        return "bg-warning";
      case "partial_outage":
        return "bg-destructive/70";
      case "major_outage":
        return "bg-destructive";
      default:
        return "bg-muted";
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="admin-page-header">
          <div>
            <h1 className="text-2xl font-bold">Status do Sistema</h1>
            <p className="text-muted-foreground">
              Últimas verificações dos serviços
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {lastFullCheck && (
              <span className="text-sm text-muted-foreground">
                Último check: {formatDistanceToNow(lastFullCheck, { addSuffix: true, locale: ptBR })}
              </span>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearHistoricalData}
              disabled={isClearingHistory || isLoading}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {isClearingHistory ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              <span className="ml-2">Limpar Histórico</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={runHealthCheck}
              disabled={isRunningCheck || isLoading}
            >
              {isRunningCheck ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Verificar Agora</span>
            </Button>
          </div>
        </div>

        {readError && <p role="alert" className="text-warning">Não foi possível atualizar os dados de monitoramento. Isso não confirma uma indisponibilidade dos serviços.</p>}
        {incidentReadError && <p role="alert" className="text-warning">A consulta de incidentes não está disponível.</p>}

        {/* Overall Status Banner */}
        <div className={cn(
          "rounded-lg p-5 border flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center",
          statusConfig[overallStatus].bgColor,
          "border-border"
        )}>
          <div className="flex w-full min-w-0 flex-1 items-center gap-3">
            <div className={cn("shrink-0 p-3 rounded-full", statusConfig[overallStatus].bgColor)}>
              <Activity className={cn("h-6 w-6", statusConfig[overallStatus].color)} />
            </div>
            <div>
              <h2 className={cn("text-base font-bold", statusConfig[overallStatus].color)}>
                {getOverallStatusMessage()}
              </h2>
              <p className="text-sm text-muted-foreground">
                {incidents.length > 0 
                  ? `${incidents.length} incidente(s) ativo(s)` 
                  : incidentReadError ? "Incidentes sem confirmação" : "Nenhum incidente registrado"}
              </p>
            </div>
          </div>
          <div className={cn(
            "px-3 py-1 rounded-md text-xs font-semibold",
            statusConfig[overallStatus].bgColor,
            statusConfig[overallStatus].color
          )}>
            {statusConfig[overallStatus].label}
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map((service) => (
            <div 
              key={service.id}
              className="bg-card border border-border rounded-lg p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    statusConfig[service.status].bgColor
                  )}>
                    <span className={statusConfig[service.status].color}>
                      {service.icon}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold">{service.name}</h3>
                    <p className="text-xs text-muted-foreground">{service.description}</p>
                  </div>
                </div>
                <div className={cn(
                  "flex items-center gap-1",
                  statusConfig[service.status].color
                )}>
                  {statusConfig[service.status].icon}
                </div>
              </div>
              
              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium",
                    statusConfig[service.status].bgColor,
                    statusConfig[service.status].color
                  )}>
                    {statusConfig[service.status].label}
                  </span>
                </div>
                
                {service.responseTime !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Latência</span>
                    <span className="font-mono text-muted-foreground">
                      {service.responseTime}ms
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Verificado: {service.lastChecked ? formatDistanceToNow(service.lastChecked, { addSuffix: true, locale: ptBR }) : 'sem amostra'}</p>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground" title={`${service.samples} verificações confirmadas nos últimos 30 dias`}>Disponibilidade medida</span>
                  <span className={cn(
                    "font-medium",
                    service.uptime === null ? "text-muted-foreground" : service.uptime >= 99 ? "text-success" :
                    service.uptime >= 95 ? "text-warning" : "text-destructive"
                  )}>
                    {service.uptime !== null ? `${service.uptime}%` : "—"}
                  </span>
                </div>

                {service.error && (
                  <div className={cn("mt-2 p-2 rounded text-xs", service.status === 'major_outage' || service.status === 'partial_outage' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground')}>
                    {service.error}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Active Incidents */}
        {incidents.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30">
              <h2 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Incidentes Ativos
              </h2>
            </div>
            <div className="divide-y divide-border">
              {incidents.map((incident) => (
                <div key={incident.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium">{incident.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        Iniciado {formatDistanceToNow(incident.createdAt, { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        incidentStatusConfig[incident.status].bgColor,
                        incidentStatusConfig[incident.status].color
                      )}>
                        {incidentStatusConfig[incident.status].label}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium border",
                        incident.severity === "critical" ? "border-destructive text-destructive" :
                        incident.severity === "major" ? "border-warning text-warning" :
                        "border-muted-foreground text-muted-foreground"
                      )}>
                        {incident.severity === "critical" ? "Crítico" :
                         incident.severity === "major" ? "Maior" : "Menor"}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mb-3">
                    {incident.affectedServices.map((serviceId) => {
                      const service = services.find(s => s.id === serviceId);
                      return (
                        <span key={serviceId} className="px-2 py-0.5 bg-secondary rounded text-xs">
                          {service?.name || serviceId}
                        </span>
                      );
                    })}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <Clock className="inline h-4 w-4 mr-1" />
                    {incident.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Uptime History */}
        <section className="border-t border-border pt-6">
          <h2 className="font-semibold mb-4">Histórico de verificações (90 dias)</h2>
          {Object.keys(uptimeHistory).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum dado de histórico ainda.</p>
              <p className="text-sm">Execute um health check para começar a coletar dados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-2"><div className="min-w-[680px] space-y-4">
              {services.map((service) => {
                const history = uptimeHistory[service.id] || [];
                return (
                  <div key={service.id} className="flex items-center gap-4">
                    <div className="w-40 shrink-0 flex items-center gap-2">
                      {service.icon}
                      <span className="text-sm font-medium truncate">{service.name}</span>
                    </div>
                    <div className="flex-1 flex gap-0.5">
                      {history.map((day, i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-8 flex-1 rounded-sm transition-colors cursor-pointer hover:opacity-80",
                            getStatusBarColor(day.status)
                          )}
                          title={`${format(day.date, "dd/MM/yyyy")}: ${day.checks} verificações, ${day.operational} operacionais`}
                        />
                      ))}
                    </div>
                    <div className="w-16 text-right">
                      <span className={cn(
                        "text-sm font-medium",
                        service.uptime === null ? "text-muted-foreground" : service.uptime >= 99 ? "text-success" :
                        service.uptime >= 95 ? "text-warning" : "text-destructive"
                      )}>
                        {service.uptime !== null ? `${service.uptime}%` : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div></div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            Amostras com os critérios atuais, a cada 5 minutos. Percentual de respostas disponíveis em 30 dias, não uptime contínuo. Histórico anterior preservado fora deste cálculo. Horário de Brasília.
          </p>
        </section>
      </div>
    </AdminLayout>
  );
}
