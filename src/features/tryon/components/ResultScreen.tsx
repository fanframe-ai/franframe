import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, RefreshCw } from 'lucide-react';
import type { TeamShirt, TeamBackground } from '@/features/teams/TeamContext';
import { useTeam } from '@/features/teams/TeamContext';
import { useToast } from '@/components/ui/use-toast';
import { useTeamAccent } from '@/features/teams/hooks/useTeamAccent';
import { credentials, generationStatus, invoke } from '@/integrations/supabase/functions';
import { downloadGeneration } from '@/features/tryon/download';
interface ResultScreenProps {
  userImage: string; selectedShirt: TeamShirt; selectedBackground: TeamBackground;
  balance: number; onTryAgain: () => void; onBalanceUpdate: (balance: number) => void;
  onNoCredits: () => void; onHistory?: () => void;
}
const getProgressMessage = (progress: number, _position: number, name: string) => ({
  title: progress < 95 ? 'Preparando sua foto...' : 'Finalizando...',
  subtitle: `Vestindo o manto do ${name}`,
});
export const ResultScreen = ({ userImage, selectedShirt, selectedBackground, balance, onTryAgain, onBalanceUpdate, onNoCredits, onHistory }: ResultScreenProps) => {
  const { team } = useTeam(); const { toast } = useToast(); const { accent, accentFg } = useTeamAccent();
  const initial = useRef({ userImage, selectedShirt, selectedBackground, balance, onBalanceUpdate, onNoCredits });
  const generationId = useRef<string | null>(null);
  const teamSlug = team?.slug;
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [isGenerating, setIsGenerating] = useState(true);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [queuePosition] = useState(1);
  const [isDownloading, setIsDownloading] = useState(false);
  useEffect(() => {
    if (!teamSlug) return;
    let active = true; let timer: ReturnType<typeof setTimeout>;
    async function start() {
      try {
        if (initial.current.balance <= 0) { initial.current.onNoCredits(); return; }
        const result = await invoke<{ queueId: string }>('generate-tryon', {
          ...credentials(teamSlug!), request_id: requestId, consent: true,
          userImageBase64: initial.current.userImage, shirtId: initial.current.selectedShirt.id, backgroundId: initial.current.selectedBackground.id,
        });
        generationId.current = result.queueId;
        async function poll() {
          if (!active) return;
          try {
            const status = await generationStatus(teamSlug!, result.queueId);
            if (!active) return;
            if (status.status === 'completed' && status.result_image_url) {
              setProgress(100); setGeneratedImage(status.result_image_url); setIsGenerating(false);
              const latest = await invoke<{ balance: number }>('fanframe-proxy', { ...credentials(teamSlug!), action: 'balance' });
              if (active) initial.current.onBalanceUpdate(latest.balance);
              return;
            }
            if (status.status === 'failed') throw new Error(status.error_message || 'Falha na geração');
            setProgress(value => Math.min(95, value + 2));
            timer = setTimeout(poll, 3000);
          } catch (failure) {
            if (active) { setError(failure instanceof Error ? failure.message : 'Erro ao acompanhar geração'); setIsGenerating(false); }
          }
        }
        await poll();
      } catch (failure) {
        if (active) { setError(failure instanceof Error ? failure.message : 'Erro ao iniciar geração'); setIsGenerating(false); }
      }
    }
    void start();
    return () => { active = false; clearTimeout(timer); };
  }, [requestId, teamSlug]);
  const handleDownload = async () => {
    if (!generatedImage || !teamSlug || !generationId.current || isDownloading) return;
    setIsDownloading(true);
    try { await downloadGeneration(teamSlug, generationId.current, `${teamSlug}-${Date.now()}.png`, team?.watermark_url); toast({ title: 'Download iniciado!' }); }
    catch { toast({ title: 'Erro no download', variant: 'destructive' }); }
    finally { setIsDownloading(false); }
  };
  const handleRetry = () => { setGeneratedImage(null); setRequestId(crypto.randomUUID()); setProgress(0); setError(null); setIsGenerating(true); };
  // Loading state
  if (isGenerating) {
    const { title, subtitle } = getProgressMessage(progress, queuePosition, team?.name || "Time");

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 safe-bottom">
        <div className="text-center animate-fade-in w-full max-w-md">
          {/* Spinner */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 sm:mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-white/20" />
            <div className="absolute inset-0 rounded-full border-4 border-white border-t-transparent animate-spin" />
          </div>

          <h2 className="text-xl sm:text-2xl md:text-3xl font-black mb-1 sm:mb-2 uppercase transition-all duration-300">
            {title}
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-xs mx-auto mb-6 sm:mb-8 transition-all duration-300">
            {subtitle}
          </p>

          {/* Progress Bar */}
          <div className="px-2 sm:px-4 mb-6 sm:mb-8">
            <Progress value={progress} className="h-2 sm:h-3 mb-2" />
            <p className="text-base sm:text-lg font-bold text-white">{progress}%</p>
          </div>

          {/* Queue position indicator (only show if > 5) */}
          {queuePosition > 5 && (
            <div className="mb-4 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-sm">
                <span className="text-muted-foreground">Posição na fila:</span>
                <span className="font-bold text-white">{queuePosition}</span>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="glass-card p-3 sm:p-4 rounded-xl border-2 border-warning/50 bg-warning/20">
            <p className="text-xs sm:text-sm text-warning font-semibold">
              ⚠️ Não atualize ou feche a página
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 safe-bottom">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-6 sm:mb-8 rounded-2xl bg-destructive/20 flex items-center justify-center">
            <span className="text-3xl sm:text-4xl">😢</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black mb-3 sm:mb-4 uppercase">
            Ops, deu ruim!
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base mb-6 sm:mb-8 max-w-xs mx-auto">
            {error}
          </p>
          <Button
            onClick={handleRetry}
            size="lg"
            className="btn-mobile-cta hover:opacity-90"
            style={{ backgroundColor: accent, color: accentFg }}
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className="h-[100dvh] flex flex-col items-center px-4 pt-6 pb-4 safe-bottom overflow-hidden">
      {/* Header */}
      <div className="text-center mb-1 animate-fade-in">
        <h2 className="text-xl sm:text-2xl font-black mb-0.5 uppercase tracking-tight">
          Ficou épico!
        </h2>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Você vestiu o manto do {team?.name || "time"}.
        </p>
      </div>

      {/* Credits Counter */}
      <div className="mb-1 animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <div className="px-3 py-1 rounded-full bg-white/10 text-xs">
          <span className="text-muted-foreground">Créditos: </span>
          <span className="font-bold text-white">{balance}</span>
        </div>
      </div>

      {/* Generated Image */}
      <div className="w-full max-w-md flex-1 min-h-0 max-h-[55vh] mb-2 animate-scale-in" style={{ animationDelay: "0.2s" }}>
        <div className="glass-card p-1.5 rounded-xl h-full">
          <div className="rounded-lg overflow-hidden bg-secondary h-full">
            {generatedImage && (
              <img
                src={generatedImage}
                alt={`Você com o manto do ${team?.name || "time"}`}
                className="w-full h-full object-contain"
              />
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-md space-y-2 animate-fade-in shrink-0" style={{ animationDelay: "0.3s" }}>
        <Button
          onClick={handleDownload}
          disabled={isDownloading}
          className="w-full h-10 hover:opacity-90 transition-all text-sm font-bold"
          style={{ backgroundColor: accent, color: accentFg }}
        >
          <Download className="w-4 h-4 mr-2" />
          {isDownloading ? "Baixando..." : "Baixar Foto"}
        </Button>

        <Button
          onClick={balance > 0 ? onTryAgain : onNoCredits}
          variant="outline"
          className="w-full h-10 border-white/30 hover:bg-white/10 transition-all text-sm font-bold"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          GERAR OUTRA IMAGEM
        </Button>

        {onHistory && (
          <button
            onClick={onHistory}
            className="w-full text-center text-xs text-white/50 hover:text-white/80 underline underline-offset-2 transition-colors py-1"
          >
            📸 Ver meu histórico de fotos
          </button>
        )}
      </div>

    </div>
  );
};
