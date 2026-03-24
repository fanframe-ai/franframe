import { Button } from "@/components/ui/button";
import { Camera, ShirtIcon, Sparkles, ArrowRight, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useTeam } from "@/contexts/TeamContext";
import { ASSET_URLS } from "@/config/fanframe";
import beforeExampleLocal from "@/assets/before-example.jpg";
import afterExampleLocal from "@/assets/after-example.png";

interface TutorialScreenProps {
  onContinue: () => void;
  onBack: () => void;
}

export const TutorialScreen = ({ onContinue, onBack }: TutorialScreenProps) => {
  const { team } = useTeam();
  
  const tutorialBefore = team?.tutorial_assets?.before || ASSET_URLS.tutorial.before;
  const tutorialAfter = team?.tutorial_assets?.after || ASSET_URLS.tutorial.after;
  const teamName = team?.name || "Time";
  const t = team?.text_overrides || {};
  
  const [beforeSrc, setBeforeSrc] = useState<string>(tutorialBefore);
  const [afterSrc, setAfterSrc] = useState<string>(tutorialAfter);

  const steps = [
    {
      icon: Camera,
      number: "01",
      title: "Envie uma foto",
      description: "Corpo inteiro, roupa clara",
    },
    {
      icon: ShirtIcon,
      number: "02",
      title: "Escolha a camiseta",
      description: `O manto oficial do ${teamName}`,
    },
    {
      icon: Sparkles,
      number: "03",
      title: "Veja a mágica",
      description: "A IA veste você",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-4 pt-16 safe-bottom">
      {/* Header */}
      <div className="text-center mb-3 sm:mb-6 animate-fade-in">
        <h2 className="text-xl sm:text-3xl md:text-4xl font-black mb-1 sm:mb-2 uppercase tracking-tight">
          {t.tutorial_title || "Como funciona"}
        </h2>
        <p className="text-muted-foreground text-xs sm:text-lg">
          {t.tutorial_subtitle || "Em 3 passos, você se vê vestindo o manto."}
        </p>
      </div>

      {/* Before/After Comparison */}
      <div className="w-full max-w-sm sm:max-w-lg mb-3 sm:mb-8 animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <div className="glass-card p-3 sm:p-4 rounded-2xl">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
            {/* Before */}
            <div className="relative">
              <div className="aspect-[3/4] bg-secondary rounded-xl overflow-hidden">
                <img 
                  src={beforeSrc} 
                  alt="Exemplo antes" 
                  loading="lazy"
                  className="w-full h-full object-cover object-[center_20%]"
                  onError={() => setBeforeSrc(beforeExampleLocal)}
                />
              </div>
              <span className="absolute top-2 left-2 text-[10px] sm:text-xs font-bold uppercase bg-black/50 backdrop-blur px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                Antes
              </span>
            </div>
            
            {/* Arrow */}
            <div className="flex items-center justify-center px-1 sm:px-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center">
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
            </div>
            
            {/* After */}
            <div className="relative">
              <div className="aspect-[3/4] bg-secondary rounded-xl overflow-hidden border-2 border-white/20">
                <img 
                  src={afterSrc} 
                  alt="Exemplo depois com manto" 
                  loading="lazy"
                  className="w-full h-full object-cover object-top"
                  onError={() => setAfterSrc(afterExampleLocal)}
                />
              </div>
              <span className="absolute top-2 left-2 text-[10px] sm:text-xs font-bold uppercase bg-white text-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                Depois
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="w-full max-w-4xl grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-8 px-0 sm:px-4">
        {steps.map((step, index) => (
          <div
            key={step.number}
            className="glass-card p-3 sm:p-4 rounded-xl flex flex-col items-center text-center gap-2 sm:gap-3 animate-fade-in"
            style={{ animationDelay: `${0.2 + index * 0.1}s` }}
          >
            <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-white/10 flex items-center justify-center">
              <step.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 mb-1">
                <span className="text-[10px] sm:text-xs text-muted-foreground font-mono">{step.number}</span>
                <h3 className="font-bold uppercase text-[10px] sm:text-xs leading-tight">{step.title}</h3>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3 w-full max-w-md px-4 sm:px-0 animate-fade-in" style={{ animationDelay: "0.5s" }}>
        <Button
          onClick={onContinue}
          size="lg"
          className="btn-mobile-cta bg-white text-black hover:bg-white/90 transition-all duration-300 hover:scale-105 order-1"
        >
          COMEÇAR AGORA
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
