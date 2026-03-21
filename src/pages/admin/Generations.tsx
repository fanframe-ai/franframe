import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { GenerationsTable } from "@/components/admin/GenerationsTable";
import { TeamSelector } from "@/components/admin/TeamSelector";
import { useAdminStats } from "@/hooks/useAdminStats";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCw, Loader2 } from "lucide-react";

export default function AdminGenerations() {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const { recentGenerations, isLoading, refetch } = useAdminStats(selectedTeam);
  const [filter, setFilter] = useState<"all" | "pending" | "processing" | "completed" | "failed">("all");
  const [search, setSearch] = useState("");

  const filteredGenerations = recentGenerations.filter((gen) => {
    const matchesFilter = filter === "all" || gen.status === filter;
    const matchesSearch = 
      !search || 
      gen.external_user_id?.toLowerCase().includes(search.toLowerCase()) ||
      gen.shirt_id.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const statusCounts = {
    all: recentGenerations.length,
    pending: recentGenerations.filter(g => g.status === "pending").length,
    processing: recentGenerations.filter(g => g.status === "processing").length,
    completed: recentGenerations.filter(g => g.status === "completed").length,
    failed: recentGenerations.filter(g => g.status === "failed").length,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gerações</h1>
            <p className="text-muted-foreground">Histórico de todas as gerações de imagem</p>
          </div>
          <div className="flex items-center gap-3">
            <TeamSelector value={selectedTeam} onChange={setSelectedTeam} />
            <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Atualizar</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por usuário ou camisa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["all", "pending", "processing", "completed", "failed"] as const).map((status) => (
              <Button key={status} variant={filter === status ? "default" : "outline"} size="sm" onClick={() => setFilter(status)}>
                {status === "all" && "Todas"}
                {status === "pending" && "Pendente"}
                {status === "processing" && "Processando"}
                {status === "completed" && "Sucesso"}
                {status === "failed" && "Falhas"}
                <Badge variant="secondary" className="ml-2 bg-background/20">{statusCounts[status]}</Badge>
              </Button>
            ))}
          </div>
        </div>

        <GenerationsTable generations={filteredGenerations} />

        <div className="text-sm text-muted-foreground">
          Mostrando {filteredGenerations.length} de {recentGenerations.length} gerações
        </div>
      </div>
    </AdminLayout>
  );
}
