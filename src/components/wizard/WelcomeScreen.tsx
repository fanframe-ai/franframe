import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";
import { ASSET_URLS } from "@/config/fanframe";

interface WelcomeScreenProps {
  onStart: () => void;
  onHistory?: () => void;
}

export const WelcomeScreen = ({ onStart, onHistory }: WelcomeScreenProps) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden safe-bottom">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-secondary/50" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-white/5 rounded-full blur-3xl" />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-lg animate-fade-in">
        {/* Headline */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-3 sm:mb-4 leading-tight tracking-tighter">
          VISTA A CAMISA
          <span className="block gradient-text">DO TIMÃO!</span>
        </h1>

        {/* Single Subtitle */}
        <p className="text-base sm:text-lg md:text-xl text-white/80 font-medium mb-6 sm:mb-8 leading-relaxed max-w-xs sm:max-w-sm px-2">
          IA que veste o manto do Corinthians em você. Resultado realista em segundos.
        </p>

        {/* Before/After Preview */}
        <div className="mb-6 sm:mb-8 flex items-center gap-3 sm:gap-4">
          {/* Before */}
          <div className="relative">
            <div className="w-28 h-36 sm:w-32 sm:h-40 md:w-40 md:h-52 rounded-xl overflow-hidden border-2 border-white/20">
              <img 
                src={ASSET_URLS.tutorial.before} 
                alt="Antes" 
                loading="eager"
                className="w-full h-full object-cover object-[center_20%]"
              />
            </div>
            <span className="absolute -bottom-2 sm:-bottom-3 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs uppercase tracking-wider bg-black/80 px-2 sm:px-3 py-0.5 sm:py-1 rounded text-white/60">
              Antes
            </span>
          </div>
          
          {/* Arrow */}
          <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 text-white/60 animate-[bounce-x_1s_ease-in-out_infinite] flex-shrink-0" />
          
          {/* After */}
          <div className="relative">
            <div className="w-28 h-36 sm:w-32 sm:h-40 md:w-40 md:h-52 rounded-xl overflow-hidden border-2 border-white ring-2 sm:ring-4 ring-white/30 ring-offset-1 sm:ring-offset-2 ring-offset-black shadow-[0_0_20px_rgba(255,255,255,0.3)]">
              <img 
                src={ASSET_URLS.tutorial.after} 
                alt="Depois" 
                loading="eager"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="absolute -bottom-2 sm:-bottom-3 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs uppercase tracking-wider bg-white text-black px-2 sm:px-3 py-0.5 sm:py-1 rounded font-semibold">
              Depois
            </span>
          </div>
        </div>

        {/* CTA Button */}
        <Button
          onClick={onStart}
          size="lg"
          className="btn-mobile-cta w-full max-w-xs sm:w-auto bg-white text-black hover:bg-white/90 transition-all duration-300 hover:scale-105"
        >
          EXPERIMENTAR AGORA
        </Button>

        {/* Trust Elements */}
        <div className="mt-8 sm:mt-10 flex flex-col items-center gap-2 sm:gap-3">
          {/* History link */}
          {onHistory && (
            <button
              onClick={onHistory}
              className="text-xs sm:text-sm text-white/60 hover:text-white/90 underline underline-offset-2 transition-colors"
            >
              📸 Meu Histórico de Fotos
            </button>
          )}

          {/* Social Proof */}
          <p className="text-xs sm:text-sm text-white/70 font-medium">
            + de 10.000 Fiéis já vestiram
          </p>
          
          {/* AI Badge */}
          <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-white/10 bg-white/5">
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white/50" />
            <span className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wider">
              Tecnologia de IA
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};