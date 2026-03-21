import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AlertsList } from "@/components/admin/AlertsList";
import { TeamSelector } from "@/components/admin/TeamSelector";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2, CheckCircle } from "lucide-react";

interface SystemAlert {
  id: string;
  type: "error_spike" | "slow_processing" | "high_usage" | "api_error";
  message: string;
  severity: "info" | "warning" | "critical";
  resolved: boolean;
  created_at: string;
}

export default function AdminAlerts() {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "resolved" | "all">("active");
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("system_alerts")
        .select("*")
        .order("created_at", { ascending: false });

      if (filter === "active") query = query.eq("resolved", false);
      else if (filter === "resolved") query = query.eq("resolved", true);
      if (selectedTeam) query = query.eq("team_id", selectedTeam);

      const { data, error } = await query;
      if (error) throw error;
      setAlerts((data as SystemAlert[]) || []);
    } catch (err) {
      console.error("Error fetching alerts:", err);
    } finally {
      setIsLoading(false);
    }
  }, [filter, selectedTeam]);

  useEffect(() => {
    fetchAlerts();
    const channel = supabase
      .channel("admin-alerts-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_alerts" }, () => fetchAlerts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAlerts]);

  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from("system_alerts")
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq("id", alertId);
      if (error) throw error;
      setAlerts(prev =>
        prev.map(a => a.id === alertId ? { ...a, resolved: true } : a)
          .filter(a => filter === "all" || (filter === "active" ? !a.resolved : a.resolved))
      );
    } catch (err) {
      console.error("Error resolving alert:", err);
    }
  };

  const resolveAllAlerts = async () => {
    try {
      const { error } = await supabase
        .from("system_alerts")
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq("resolved", false);
      if (error) throw error;
      fetchAlerts();
    } catch (err) {
      console.error("Error resolving all alerts:", err);
    }
  };

  const activeCount = alerts.filter(a => !a.resolved).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Alertas do Sistema</h1>
            <p className="text-muted-foreground">Monitore e resolva alertas de performance e erros</p>
          </div>
          <div className="flex items-center gap-3">
            <TeamSelector value={selectedTeam} onChange={setSelectedTeam} />
            {activeCount > 0 && filter === "active" && (
              <Button variant="outline" size="sm" onClick={resolveAllAlerts}>
                <CheckCircle className="h-4 w-4 mr-2" />Resolver Todos
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={fetchAlerts} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          {(["active", "resolved", "all"] as const).map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
              {f === "active" && "Ativos"}
              {f === "resolved" && "Resolvidos"}
              {f === "all" && "Todos"}
              {f === "active" && activeCount > 0 && (
                <Badge variant="secondary" className="ml-2 bg-destructive text-destructive-foreground">{activeCount}</Badge>
              )}
            </Button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AlertsList alerts={alerts.filter(a => !a.resolved || filter !== "active")} onResolve={resolveAlert} />
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
