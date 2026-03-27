import { Button } from "@/components/ui/button";
import { Check, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeam, type TeamBackground } from "@/contexts/TeamContext";
import { useAssetTextOverrides } from "@/hooks/useAssetTextOverrides";

// Re-export for backward compatibility
export type { TeamBackground as Background } from "@/contexts/TeamContext";

interface BackgroundSelectionScreenProps {
  selectedBackground: TeamBackground | null;
  onSelectBackground: (background: TeamBackground) => void;
  onContinue: () => void;
  onBack: () => void;
}

export const BackgroundSelectionScreen = ({
  selectedBackground,
  onSelectBackground,
  onContinue,
  onBack,
}: BackgroundSelectionScreenProps) => {
  const canContinue = selectedBackground !== null;
  const { team } = useTeam();
  const { getName, getSubtitle, isVisible } = useAssetTextOverrides("backgrounds_text_overrides");
  const t = team?.text_overrides || {};
  
  const backgrounds = team?.backgrounds || [];
  const visibleBackgrounds = backgrounds.filter(b => isVisible(b.id));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-4 pt-16 safe-bottom">
      <div className="text-center mb-4 animate-fade-in">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black mb-1 uppercase tracking-tight px-2">
          {t.background_title || "Escolha o cenário"}
        </h2>
      </div>

      <div className="w-full max-w-lg grid grid-cols-1 gap-2 sm:gap-3 mb-6">
        {visibleBackgrounds.map((background, index) => {
          const isSelected = selectedBackground?.id === background.id;
          return (
            <button
              key={background.id}
              onClick={() => onSelectBackground(background)}
              className={cn(
                "relative p-2.5 sm:p-3 rounded-xl transition-all duration-300 animate-fade-in text-left touch-active",
                isSelected ? "glass-card-selected scale-[1.02]" : "glass-card hover:bg-white/10"
              )}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="relative flex-shrink-0 w-20 h-14 sm:w-24 sm:h-16 rounded-lg overflow-hidden bg-secondary">
                  <img
                    src={background.imageUrl}
                    alt={background.name}
                    width={96}
                    height={64}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm sm:text-base uppercase mb-0.5 truncate">{getName(background.id, background.name)}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                    {getSubtitle(background.id, background.subtitle)}
                  </p>
                </div>
                <div
                  className={cn(
                    "flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-all",
                    isSelected ? "border-white" : "border-white/30"
                  )}
                  style={isSelected ? { backgroundColor: team?.primary_color || '#FFFFFF' } : {}}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: team?.secondary_color || '#000000' }} />}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 w-full max-w-md px-4 sm:px-0 animate-fade-in" style={{ animationDelay: "0.4s" }}>
        <Button
          onClick={onContinue}
          disabled={!canContinue}
          size="lg"
          className="btn-mobile-cta transition-all duration-300 hover:scale-105 hover:opacity-90 disabled:opacity-50 disabled:hover:scale-100 order-1"
          style={{ backgroundColor: team?.primary_color || '#FFFFFF', color: team?.secondary_color || '#000000' }}
        >
          Continuar
        </Button>
        <Button
          onClick={onBack}
          size="lg"
          variant="outline"
          className="btn-mobile border-white/30 hover:bg-white/10 transition-all order-2"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          VOLTAR
        </Button>
      </div>
    </div>
  );
};
