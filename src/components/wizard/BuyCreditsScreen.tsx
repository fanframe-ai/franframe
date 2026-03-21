import { Button } from "@/components/ui/button";
import { Coins, RefreshCw, CreditCard } from "lucide-react";
import { useTeam } from "@/contexts/TeamContext";

interface BuyCreditsScreenProps {
  balance: number;
  onRefreshBalance: () => Promise<void>;
  isRefreshing?: boolean;
  onContinue?: () => void;
  fetchBalance: () => Promise<number | null>;
}

interface PackageInfo {
  credits: number;
  price: string;
  highlight: boolean;
  badge?: string;
  checkoutUrl: string;
}

export const BuyCreditsScreen = ({ 
  balance, 
  onRefreshBalance, 
  isRefreshing, 
  onContinue,
}: BuyCreditsScreenProps) => {
  const { team } = useTeam();
  
  const purchaseUrls = team?.purchase_urls || {};

  const handlePurchaseClick = (pkg: PackageInfo, event: React.MouseEvent<HTMLAnchorElement>) => {
    const timestamp = new Date().toISOString();
    console.log(`[BuyCredits][${timestamp}] Pacote: ${pkg.credits} crédito(s) - ${pkg.price}`);
    console.log(`[BuyCredits][${timestamp}] URL destino: ${pkg.checkoutUrl}`);
  };

  const packages: PackageInfo[] = [
    { 
      credits: 1, 
      price: "R$ 5,90", 
      highlight: false,
      checkoutUrl: purchaseUrls.credits1 || "https://timaotourvirtual.com.br/checkout?add-to-cart=67822"
    },
    { 
      credits: 3, 
      price: "R$ 16,90", 
      highlight: true,
      badge: "Mais Popular",
      checkoutUrl: purchaseUrls.credits3 || "https://timaotourvirtual.com.br/checkout?add-to-cart=67824"
    },
    { 
      credits: 7, 
      price: "R$ 34,90", 
      highlight: false,
      badge: "Melhor Valor",
      checkoutUrl: purchaseUrls.credits7 || "https://timaotourvirtual.com.br/checkout?add-to-cart=67825"
    },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 pt-16 safe-bottom">
      {/* Header */}
      <div className="text-center mb-6 sm:mb-8 animate-fade-in">
        <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-2xl bg-warning/20 flex items-center justify-center">
          <Coins className="w-7 h-7 sm:w-8 sm:h-8 text-warning" />
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-1 sm:mb-2 uppercase tracking-tight">
          Sem créditos
        </h2>
        <p className="text-muted-foreground text-sm sm:text-lg">
          Adquira créditos para gerar suas fotos
        </p>
        <p className="text-xs sm:text-sm text-muted-foreground/80 mt-2">
          💡 Cada foto gerada equivale a 1 crédito
        </p>
      </div>

      {/* Packages */}
      <div className="w-full max-w-md space-y-3 sm:space-y-4 mb-6 sm:mb-8 animate-fade-in" style={{ animationDelay: "0.1s" }}>
        {packages.map((pkg) => (
          <div
            key={pkg.credits}
            className={`glass-card p-4 sm:p-5 rounded-xl relative ${
              pkg.highlight ? "ring-2 ring-[#F1AF07]" : ""
            }`}
          >
            {pkg.badge && (
              <span className="absolute -top-2 right-3 sm:right-4 px-2 py-0.5 text-[10px] sm:text-xs font-bold bg-[#F1AF07] text-black rounded-full whitespace-nowrap">
                {pkg.badge}
              </span>
            )}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-base sm:text-lg">
                  {pkg.credits} {pkg.credits === 1 ? "Crédito" : "Créditos"}
                </div>
                <div className="text-xl sm:text-2xl font-black">{pkg.price}</div>
              </div>
              <a
                href={pkg.checkoutUrl}
                target="_top"
                onClick={(e) => handlePurchaseClick(pkg, e)}
                className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-9 px-4 py-2 touch-target flex-shrink-0 ${
                  pkg.highlight 
                    ? "bg-[#F1AF07] text-black hover:bg-[#F1AF07]/90" 
                    : "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Comprar
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Refresh balance */}
      <div className="text-center animate-fade-in" style={{ animationDelay: "0.2s" }}>
        <p className="text-xs sm:text-sm text-muted-foreground mb-3">
          Já pagou? Atualize seu saldo:
        </p>
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
          <Button
            variant="outline"
            onClick={onRefreshBalance}
            disabled={isRefreshing}
            className="touch-target"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Atualizando..." : "Atualizar Saldo"}
          </Button>
          {onContinue && (
            <Button
              onClick={onContinue}
              disabled={balance === 0}
              className="touch-target"
            >
              {balance > 0 ? "Continuar" : "Compre créditos para continuar"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
