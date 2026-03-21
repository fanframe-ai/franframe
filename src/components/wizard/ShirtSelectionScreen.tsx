import { Button } from "@/components/ui/button";
import { Check, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeam, type TeamShirt } from "@/contexts/TeamContext";
import { useAssetTextOverrides } from "@/hooks/useAssetTextOverrides";

// Re-export for backward compatibility
export type Shirt = TeamShirt;

interface ShirtSelectionScreenProps {
  selectedShirt: Shirt | null;
  onSelectShirt: (shirt: Shirt) => void;
  onContinue: () => void;
  onBack: () => void;
}

export const ShirtSelectionScreen = ({
  selectedShirt,
  onSelectShirt,
  onContinue,
  onBack,
}: ShirtSelectionScreenProps) => {
  const canContinue = selectedShirt !== null;
  const { team } = useTeam();
  const { getName, getSubtitle, isVisible } = useAssetTextOverrides("shirts_text_overrides");
  
  const shirts = team?.shirts || [];
  const visibleShirts = shirts.filter(s => isVisible(s.id));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-4 pt-16 safe-bottom">
      <div className="text-center mb-4 animate-fade-in">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black mb-1 uppercase tracking-tight px-2">
          Qual manto você vai vestir?
        </h2>
      </div>

      <div className="w-full max-w-lg grid grid-cols-1 gap-2 sm:gap-3 mb-6">
        {visibleShirts.map((shirt, index) => {
          const isSelected = selectedShirt?.id === shirt.id;
          return (
            <button
              key={shirt.id}
              onClick={() => onSelectShirt(shirt)}
              className={cn(
                "relative p-2.5 sm:p-3 rounded-xl transition-all duration-300 animate-fade-in text-left touch-active",
                isSelected ? "glass-card-selected scale-[1.02]" : "glass-card hover:bg-white/10"
              )}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-white">
                  <img
                    src={shirt.imageUrl}
                    alt={shirt.name}
                    width={80}
                    height={80}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm sm:text-base uppercase mb-0.5 truncate">{getName(shirt.id, shirt.name)}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                    {getSubtitle(shirt.id, shirt.subtitle)}
                  </p>
                </div>
                <div
                  className={cn(
                    "flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-all",
                    isSelected ? "bg-white border-white" : "border-white/30"
                  )}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 w-full max-w-md px-4 sm:px-0 animate-fade-in" style={{ animationDelay: "0.3s" }}>
        <Button
          onClick={onContinue}
          disabled={!canContinue}
          size="lg"
          className="btn-mobile-cta bg-white text-black hover:bg-white/90 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 order-1"
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
