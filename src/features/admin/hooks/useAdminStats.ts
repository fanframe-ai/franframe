import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AggregateStats } from '@/features/admin/stats';
import { reportError } from '@/lib/diagnostics';

interface TodayStats {
  totalGenerations: number;
  successfulGenerations: number;
  failedGenerations: number;
  avgProcessingTime: number;
  uniqueUsers: number;
  successRate: number;
  costCents: number;
}

interface Generation {
  id: string;
  external_user_id: string | null;
  shirt_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  error_message: string | null;
  processing_time_ms: number | null;
  created_at: string;
  completed_at: string | null;
  team_id: string | null;
}

interface SystemAlert {
  id: string;
  type: "error_spike" | "slow_processing" | "high_usage" | "api_error";
  operation_key?: string | null;
  message: string;
  severity: "info" | "warning" | "critical";
  resolved: boolean;
  created_at: string;
}

interface HourlyData {
  hour: string;
  count: number;
  success: number;
  failed: number;
}

export function useAdminStats(teamId?: string | null) {
  const [todayStats, setTodayStats] = useState<TodayStats>({
    totalGenerations: 0,
    successfulGenerations: 0,
    failedGenerations: 0,
    avgProcessingTime: 0,
    uniqueUsers: 0,
    successRate: 0,
    costCents: 0,
  });
  const [recentGenerations, setRecentGenerations] = useState<Generation[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<SystemAlert[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTodayStats = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error: genError } = await supabase.rpc('admin_generation_stats', { p_start: today.toISOString(), p_team: teamId || undefined });
      if (genError) throw genError;
      const stats = data as unknown as AggregateStats;
      const { total, success: successful, failed, avg_time: avgTime, unique_users: uniqueUsers } = stats.totals;
      setTodayStats({
        totalGenerations: total,
        successfulGenerations: successful,
        failedGenerations: failed,
        avgProcessingTime: Math.round(avgTime),
        uniqueUsers,
        successRate: total > 0 ? Math.round((successful / total) * 100) : 100,
        costCents: stats.cost_cents,
      });

      // Calculate hourly data
      const hourlyMap = new Map<string, { count: number; success: number; failed: number }>();
      for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, "0");
        hourlyMap.set(hour, { count: 0, success: 0, failed: 0 });
      }

      stats.hourly.forEach(item => hourlyMap.set(String(item.hour).padStart(2, '0'), item));

      setHourlyData(
        Array.from(hourlyMap.entries()).map(([hour, data]) => ({
          hour: `${hour}:00`,
          ...data,
        }))
      );
    } catch (err) {
      reportError('admin_stats_failed', err);
      setError("Erro ao carregar estatísticas");
    }
  }, [teamId]);

  const fetchRecentGenerations = useCallback(async (limit = 50) => {
    try {
      let query = supabase
        .from("generations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (teamId) query = query.eq("team_id", teamId);

      const { data, error: genError } = await query;
      if (genError) throw genError;

      setRecentGenerations((data as Generation[]) || []);
    } catch (err) {
      reportError('admin_generations_failed', err);
    }
  }, [teamId]);

  const fetchActiveAlerts = useCallback(async () => {
    try {
      let query = supabase
        .from("system_alerts")
        .select("*")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(100);

      if (teamId) query = query.or(`team_id.eq.${teamId},team_id.is.null`);

      const { data, error: alertError } = await query;
      if (alertError) throw alertError;

      setActiveAlerts((data as SystemAlert[]) || []);
    } catch (err) {
      reportError('admin_incidents_failed', err);
    }
  }, [teamId]);

  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from("system_alerts")
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq("id", alertId);

      if (error) throw error;
      setActiveAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err) {
      reportError('admin_incident_resolve_failed', err);
    }
  };

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([
      fetchTodayStats(),
      fetchRecentGenerations(),
      fetchActiveAlerts(),
    ]);
    setIsLoading(false);
  }, [fetchTodayStats, fetchRecentGenerations, fetchActiveAlerts]);

  useEffect(() => {
    fetchAllData();

    const interval = setInterval(fetchAllData, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchAllData, fetchTodayStats, fetchRecentGenerations, fetchActiveAlerts]);

  return {
    todayStats,
    recentGenerations,
    activeAlerts,
    hourlyData,
    isLoading,
    error,
    refetch: fetchAllData,
    resolveAlert,
  };
}
