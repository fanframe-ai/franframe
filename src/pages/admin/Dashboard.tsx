import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatsCard } from "@/components/admin/StatsCard";
import { GenerationsTable } from "@/components/admin/GenerationsTable";
import { AlertsList } from "@/components/admin/AlertsList";
import { TeamSelector } from "@/components/admin/TeamSelector";
import { useAdminStats } from "@/hooks/useAdminStats";
import { 
  ImageIcon, 
  Clock, 
  Users, 
  TrendingUp,
  RefreshCw,
  Loader2,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function AdminDashboard() {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const { 
    todayStats, 
    recentGenerations, 
    activeAlerts, 
    hourlyData,
    isLoading, 
    refetch,
    resolveAlert 
  } = useAdminStats(selectedTeam);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Visão geral do sistema FanFrame</p>
          </div>
          <div className="flex items-center gap-3">
            <TeamSelector value={selectedTeam} onChange={setSelectedTeam} />
            <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Atualizar</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatsCard title="Total Gerações (Hoje)" value={todayStats.totalGenerations} icon={<ImageIcon className="h-5 w-5" />} />
          <StatsCard
            title="Taxa de Sucesso"
            value={`${todayStats.successRate}%`}
            subtitle={`${todayStats.successfulGenerations} de ${todayStats.totalGenerations}`}
            icon={<TrendingUp className="h-5 w-5" />}
            variant={todayStats.successRate >= 90 ? "success" : todayStats.successRate >= 70 ? "warning" : "destructive"}
          />
          <StatsCard
            title="Tempo Médio"
            value={`${(todayStats.avgProcessingTime / 1000).toFixed(1)}s`}
            icon={<Clock className="h-5 w-5" />}
            variant={todayStats.avgProcessingTime < 30000 ? "default" : "warning"}
          />
          <StatsCard title="Usuários Únicos" value={todayStats.uniqueUsers} icon={<Users className="h-5 w-5" />} />
          <StatsCard
            title="Custo API (Hoje)"
            value={`$${(todayStats.successfulGenerations * 0.04).toFixed(2)}`}
            subtitle={`${todayStats.successfulGenerations} × $0.04`}
            icon={<DollarSign className="h-5 w-5" />}
          />
        </div>

        {/* Charts & Alerts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold mb-4">Gerações por Hora (Hoje)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Line type="monotone" dataKey="count" name="Total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="success" name="Sucesso" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="failed" name="Falhas" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold mb-4">Alertas Ativos ({activeAlerts.length})</h2>
            <AlertsList alerts={activeAlerts} onResolve={resolveAlert} />
          </div>
        </div>

        {/* Recent Generations */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Gerações Recentes</h2>
            <a href="/admin/generations" className="text-sm text-primary hover:underline">Ver todas →</a>
          </div>
          <GenerationsTable generations={recentGenerations.slice(0, 10)} />
        </div>
      </div>
    </AdminLayout>
  );
}
