import { Lock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTeam } from "@/contexts/TeamContext";

export const AccessDeniedScreen = () => {
  const { team } = useTeam();
  const teamName = team?.name || "time";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 safe-bottom">
      <div className="text-center animate-fade-in max-w-md">
        {/* Icon */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 rounded-2xl bg-muted/20 flex items-center justify-center">
          <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black mb-3 sm:mb-4 uppercase tracking-tight">
          Acesso Restrito
        </h1>

        {/* Description */}
        <p className="text-muted-foreground text-sm sm:text-lg mb-6 sm:mb-8 px-2">
          Para criar sua foto com a camisa do {teamName}, você precisa acessar pelo tour virtual.
        </p>

        {/* Instructions */}
        <div className="glass-card p-4 sm:p-6 rounded-xl text-left mb-6 sm:mb-8">
          <h3 className="font-bold text-sm sm:text-base mb-2 sm:mb-3">Como acessar:</h3>
          <ol className="space-y-2 text-xs sm:text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="font-bold text-foreground flex-shrink-0">1.</span>
              <span>Acesse o tour virtual do Memorial</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-foreground flex-shrink-0">2.</span>
              <span>Navegue até o ponto do FanFrame</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-foreground flex-shrink-0">3.</span>
              <span>Clique no botão para criar sua foto</span>
            </li>
          </ol>
        </div>

        {/* CTA */}
        <Button
          size="lg"
          className="w-full btn-mobile-cta"
          onClick={() => window.open(team?.wordpress_api_base?.replace(/\/wp-json.*/, "") || "#", "_blank")}
        >
          Visitar Site Oficial
          <ExternalLink className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
};