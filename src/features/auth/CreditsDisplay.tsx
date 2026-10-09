import { RefreshCw, Coins } from "lucide-react";

interface CreditsDisplayProps {
  balance: number;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const CreditsDisplay = ({ balance, isLoading, onRefresh }: CreditsDisplayProps) => {
  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-background/60 backdrop-blur-md border border-border/30 text-xs">
      <Coins className="w-3 h-3 text-destructive" />
      <span className="font-medium">{balance}</span>
      {onRefresh && (
        <button
          aria-label="Atualizar saldo"
          title="Atualizar saldo"
          className="p-0.5 rounded-full hover:bg-muted/50 disabled:opacity-50"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`w-2.5 h-2.5 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      )}
    </div>
  );
};
