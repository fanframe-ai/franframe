import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Generation {
  id: string;
  external_user_id: string | null;
  shirt_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  error_message: string | null;
  processing_time_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

interface GenerationsTableProps {
  generations: Generation[];
  showUser?: boolean;
}

const statusConfig = {
  pending: { label: "Pendente", variant: "secondary" as const },
  processing: { label: "Processando", variant: "default" as const },
  completed: { label: "Sucesso", variant: "default" as const },
  failed: { label: "Falhou", variant: "destructive" as const },
};

export function GenerationsTable({ generations, showUser = true }: GenerationsTableProps) {
  if (generations.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhuma geração encontrada
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Status</TableHead>
            {showUser && <TableHead>Usuário</TableHead>}
            <TableHead>Camisa</TableHead>
            <TableHead>Tempo</TableHead>
            <TableHead>Quando</TableHead>
            <TableHead>Erro</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {generations.map((gen) => (
            <TableRow key={gen.id}>
              <TableCell>
                <Badge
                  variant={statusConfig[gen.status].variant}
                  className={gen.status === "completed" ? "bg-success text-success-foreground" : ""}
                >
                  {statusConfig[gen.status].label}
                </Badge>
              </TableCell>
              {showUser && (
                <TableCell className="font-mono text-xs">
                  {gen.external_user_id?.slice(0, 8) || "—"}
                </TableCell>
              )}
              <TableCell>{gen.shirt_id}</TableCell>
              <TableCell>
                {gen.processing_time_ms 
                  ? `${(gen.processing_time_ms / 1000).toFixed(1)}s`
                  : "—"
                }
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDistanceToNow(new Date(gen.created_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </TableCell>
              <TableCell className="max-w-[200px]">
                {gen.error_message ? (
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="text-left text-destructive text-sm truncate block w-full hover:underline cursor-pointer">
                        {gen.error_message}
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle className="text-destructive">Detalhes do Erro</DialogTitle>
                      </DialogHeader>
                      <div className="mt-4 p-4 bg-muted rounded-lg overflow-auto max-h-[60vh]">
                        <pre className="text-sm text-destructive whitespace-pre-wrap break-words font-mono">
                          {gen.error_message}
                        </pre>
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
