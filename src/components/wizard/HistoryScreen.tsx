import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, X, Clock, Loader2 } from "lucide-react";
import { useGenerationHistory, type HistoryEntry } from "@/hooks/useGenerationHistory";
import { useToast } from "@/hooks/use-toast";
import { useTeam } from "@/contexts/TeamContext";

interface HistoryScreenProps {
  onBack: () => void;
}

const SHIRT_NAMES: Record<string, string> = {
  "manto-1": "Manto Principal",
  "manto-2": "Manto Visitante",
  "manto-3": "Manto Alternativo",
};

export const HistoryScreen = ({ onBack }: HistoryScreenProps) => {
  const { entries, isLoading } = useGenerationHistory();
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const { toast } = useToast();
  const { team } = useTeam();

  const handleDownload = async (entry: HistoryEntry) => {
    try {
      const response = await fetch(entry.result_image_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `provador-timao-${entry.id.slice(0, 8)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Download iniciado!" });
    } catch {
      toast({ title: "Erro no download", variant: "destructive" });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-4 py-6 safe-bottom">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
            Meu Histórico
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm">
            {entries.length} {entries.length === 1 ? "foto gerada" : "fotos geradas"}
          </p>
        </div>
      </div>

      {/* Empty state */}
      {entries.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Clock className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-bold mb-1">Nenhuma foto ainda</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            Suas fotos geradas aparecerão aqui para você baixar quando quiser.
          </p>
          <Button onClick={onBack} className="mt-6 bg-white text-black hover:bg-white/90">
            Gerar minha primeira foto
          </Button>
        </div>
      )}

      {/* Grid */}
      {entries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {entries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setSelectedEntry(entry)}
              className="group relative aspect-[3/4] rounded-xl overflow-hidden border-2 border-white/10 hover:border-white/30 transition-all"
            >
              <img
                src={entry.result_image_url}
                alt="Foto gerada"
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <p className="text-[10px] sm:text-xs text-white/80">
                  {SHIRT_NAMES[entry.shirt_id] || entry.shirt_id}
                </p>
                <p className="text-[9px] sm:text-[10px] text-white/50">
                  {formatDate(entry.created_at)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in">
          <div className="absolute top-4 right-4 flex gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleDownload(selectedEntry)}
              className="text-white hover:bg-white/10"
            >
              <Download className="w-5 h-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setSelectedEntry(null)}
              className="text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <img
            src={selectedEntry.result_image_url}
            alt="Foto gerada"
            className="max-w-full max-h-[80vh] object-contain rounded-lg"
          />
          <div className="mt-4 text-center">
            <p className="text-sm text-white/80">
              {SHIRT_NAMES[selectedEntry.shirt_id] || selectedEntry.shirt_id}
            </p>
            <p className="text-xs text-white/50">{formatDate(selectedEntry.created_at)}</p>
          </div>
        </div>
      )}
    </div>
  );
};
