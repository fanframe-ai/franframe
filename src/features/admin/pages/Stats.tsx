import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/features/admin/components/AdminLayout";
import { StatsCard } from "@/features/admin/components/StatsCard";
import { TeamSelector } from "@/features/admin/components/TeamSelector";
import { supabase } from "@/integrations/supabase/client";
import { brazilDateKey, type AggregateStats } from '@/features/admin/stats';
import { 
  ImageIcon, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Users,
  RefreshCw,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface DailyData {
  date: string;
  total: number;
  success: number;
  failed: number;
}

interface ShirtData {
  name: string;
  value: number;
}

export default function AdminStats() {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [period, setPeriod] = useState<7 | 30 | 90>(7);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [shirtData, setShirtData] = useState<ShirtData[]>([]);
  const [totals, setTotals] = useState({
    total: 0, success: 0, failed: 0, avgTime: 0, uniqueUsers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);

      const { data, error } = await supabase.rpc('admin_generation_stats', { p_start: startDate.toISOString(), p_team: selectedTeam || undefined });
      if (error) throw error;
      const stats = data as unknown as AggregateStats;
      setTotals({ total: stats.totals.total, success: stats.totals.success, failed: stats.totals.failed, avgTime: stats.totals.avg_time, uniqueUsers: stats.totals.unique_users });

      const dailyMap = new Map<string, { total: number; success: number; failed: number }>();
      for (let i = 0; i < period; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dailyMap.set(brazilDateKey(date), { total: 0, success: 0, failed: 0 });
      }

      stats.daily.forEach(item => { if (dailyMap.has(item.date)) dailyMap.set(item.date, item); });

      setDailyData(
        Array.from(dailyMap.entries())
          .map(([date, data]) => ({
            date: new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: 'America/Sao_Paulo', day: "2-digit", month: "2-digit" }),
            ...data,
          }))
          .reverse()
      );

      setShirtData(stats.shirts);
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setIsLoading(false);
    }
  }, [period, selectedTeam]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))"];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Estatísticas</h1>
            <p className="text-muted-foreground">Análise de performance ao longo do tempo</p>
          </div>
          <div className="flex items-center gap-2">
            <TeamSelector value={selectedTeam} onChange={setSelectedTeam} />
            {([7, 30, 90] as const).map((p) => (
              <Button key={p} variant={period === p ? "default" : "outline"} size="sm" onClick={() => setPeriod(p)}>
                {p} dias
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={fetchStats} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatsCard title="Total de Gerações" value={totals.total} icon={<ImageIcon className="h-5 w-5" />} />
          <StatsCard title="Sucessos" value={totals.success} icon={<CheckCircle className="h-5 w-5" />} variant="success" />
          <StatsCard title="Falhas" value={totals.failed} icon={<XCircle className="h-5 w-5" />} variant={totals.failed > 0 ? "destructive" : "default"} />
          <StatsCard title="Tempo Médio" value={`${(totals.avgTime / 1000).toFixed(1)}s`} icon={<Clock className="h-5 w-5" />} />
          <StatsCard title="Usuários Únicos" value={totals.uniqueUsers} icon={<Users className="h-5 w-5" />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold mb-4">Gerações por Dia</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Bar dataKey="success" name="Sucesso" fill="hsl(var(--success))" stackId="a" />
                  <Bar dataKey="failed" name="Falhas" fill="hsl(var(--destructive))" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold mb-4">Distribuição por Camisa</h2>
            <div className="h-80">
              {shirtData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={shirtData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                      {shirtData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">Sem dados ainda</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
