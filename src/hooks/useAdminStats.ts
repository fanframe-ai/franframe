import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TodayStats {
  totalGenerations: number;
  successfulGenerations: number;
  failedGenerations: number;
  avgProcessingTime: number;
  uniqueUsers: number;
  successRate: number;
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

      let query = supabase
        .from("generations")
        .select("*")
        .gte("created_at", today.toISOString());

      if (teamId) query = query.eq("team_id", teamId);

      const { data: generations, error: genError } = await query;
      if (genError) throw genError;

      const total = generations?.length || 0;
      const successful = generations?.filter(g => g.status === "completed").length || 0;
      const failed = generations?.filter(g => g.status === "failed").length || 0;
      
      const processingTimes = generations
        ?.filter(g => g.processing_time_ms)
        .map(g => g.processing_time_ms!) || [];
      
      const avgTime = processingTimes.length > 0 
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
        : 0;

      const uniqueUsers = new Set(generations?.map(g => g.external_user_id).filter(Boolean)).size;

      setTodayStats({
        totalGenerations: total,
        successfulGenerations: successful,
        failedGenerations: failed,
        avgProcessingTime: Math.round(avgTime),
        uniqueUsers,
        successRate: total > 0 ? Math.round((successful / total) * 100) : 100,
      });

      // Calculate hourly data
      const hourlyMap = new Map<string, { count: number; success: number; failed: number }>();
      for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, "0");
        hourlyMap.set(hour, { count: 0, success: 0, failed: 0 });
      }

      generations?.forEach(g => {
        const hour = new Date(g.created_at).getHours().toString().padStart(2, "0");
        const current = hourlyMap.get(hour) || { count: 0, success: 0, failed: 0 };
        current.count++;
        if (g.status === "completed") current.success++;
        if (g.status === "failed") current.failed++;
        hourlyMap.set(hour, current);
      });

      setHourlyData(
        Array.from(hourlyMap.entries()).map(([hour, data]) => ({
          hour: `${hour}:00`,
          ...data,
        }))
      );
    } catch (err) {
      console.error("Error fetching today stats:", err);
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
      console.error("Error fetching generations:", err);
    }
  }, [teamId]);

  const fetchActiveAlerts = useCallback(async () => {
    try {
      let query = supabase
        .from("system_alerts")
        .select("*")
        .eq("resolved", false)
        .order("created_at", { ascending: false });

      if (teamId) query = query.eq("team_id", teamId);

      const { data, error: alertError } = await query;
      if (alertError) throw alertError;

      setActiveAlerts((data as SystemAlert[]) || []);
    } catch (err) {
      console.error("Error fetching alerts:", err);
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
      console.error("Error resolving alert:", err);
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

    const generationsChannel = supabase
      .channel("admin-generations")
      .on("postgres_changes", { event: "*", schema: "public", table: "generations" }, () => {
        fetchTodayStats();
        fetchRecentGenerations();
      })
      .subscribe();

    const alertsChannel = supabase
      .channel("admin-alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_alerts" }, () => {
        fetchActiveAlerts();
      })
      .subscribe();

    const interval = setInterval(fetchAllData, 30000);

    return () => {
      supabase.removeChannel(generationsChannel);
      supabase.removeChannel(alertsChannel);
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
