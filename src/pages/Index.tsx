import { useState, useEffect, useCallback } from "react";
import { WelcomeScreen } from "@/components/wizard/WelcomeScreen";
import { TutorialScreen } from "@/components/wizard/TutorialScreen";
import { ShirtSelectionScreen } from "@/components/wizard/ShirtSelectionScreen";
import { BackgroundSelectionScreen } from "@/components/wizard/BackgroundSelectionScreen";
import { UploadScreen } from "@/components/wizard/UploadScreen";
import { ResultScreen } from "@/components/wizard/ResultScreen";
import { BuyCreditsScreen } from "@/components/wizard/BuyCreditsScreen";
import { HistoryScreen } from "@/components/wizard/HistoryScreen";
import { AccessDeniedScreen } from "@/components/wizard/AccessDeniedScreen";
import { StepIndicator } from "@/components/wizard/StepIndicator";
import { CreditsDisplay } from "@/components/CreditsDisplay";
import { useFanFrameAuth } from "@/hooks/useFanFrameAuth";
import { useFanFrameCredits } from "@/hooks/useFanFrameCredits";
import { useTestToken } from "@/hooks/useTestToken";
import { FANFRAME_ENABLED } from "@/config/fanframe";
import { useTeam, type TeamShirt, type TeamBackground } from "@/contexts/TeamContext";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type WizardStep = "welcome" | "buy-credits" | "tutorial" | "shirt" | "background" | "upload" | "result" | "history";

const STEP_ORDER: WizardStep[] = ["welcome", "buy-credits", "tutorial", "shirt", "background", "upload", "result"];
const STEP_LABELS = ["Início", "Créditos", "Tutorial", "Manto", "Cenário", "Foto", "Resultado"];

const Index = () => {
  const [currentStep, setCurrentStep] = useState<WizardStep>("welcome");
  const [selectedShirt, setSelectedShirt] = useState<TeamShirt | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<TeamBackground | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const { team, isLoading: teamLoading } = useTeam();

  const { 
    isAuthenticated, 
    isLoading: authLoading, 
    balance, 
    updateBalance,
    logout,
    getStoredToken,
    justExchangedRef,
  } = useFanFrameAuth();

  const { 
    fetchBalance, 
    isLoading: creditsLoading,
    clearGenerationId 
  } = useFanFrameCredits(logout);

  const {
    isTestMode,
    testBalance,
    isLoading: testTokenLoading,
    debitTestCredit,
    refreshTestBalance,
  } = useTestToken();

  // Detectar retorno do pagamento PagBank
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    
    if (paymentStatus === "success") {
      // Limpar parâmetros da URL
      window.history.replaceState({}, "", window.location.pathname);
      
      // Mostrar toast de sucesso
      toast({
        title: "Pagamento em processamento! 🎉",
        description: "Seu saldo será atualizado em instantes",
      });
      
      // Atualizar saldo após pequeno delay para dar tempo do webhook processar
      setTimeout(async () => {
        const newBalance = await fetchBalance();
        if (newBalance !== null) {
          updateBalance(newBalance);
        }
      }, 2000);
    }
  }, [fetchBalance, updateBalance]);

  // Fetch balance on initial auth (skip if we just exchanged - balance already set)
  useEffect(() => {
    let isMounted = true;
    
    const loadInitialBalance = async () => {
      // Se acabou de fazer exchange, o balance já veio correto do response
      if (justExchangedRef.current) {
        console.log("[Index] Skipping balance fetch - just exchanged, balance already set");
        justExchangedRef.current = false;
        return;
      }
      
      if (isAuthenticated && getStoredToken()) {
        const newBalance = await fetchBalance();
        if (isMounted && newBalance !== null) {
          updateBalance(newBalance);
        }
      }
    };
    
    loadInitialBalance();
    
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const goToStep = useCallback((step: WizardStep) => {
    setCurrentStep(step);
  }, []);

  const handleShirtSelect = useCallback((shirt: TeamShirt) => {
    setSelectedShirt(shirt);
  }, []);

  const handleBackgroundSelect = useCallback((background: TeamBackground) => {
    setSelectedBackground(background);
  }, []);

  const handleImageUpload = useCallback((base64: string) => {
    setUploadedImage(base64);
  }, []);

  const handleClearImage = useCallback(() => {
    setUploadedImage(null);
  }, []);

  const handleTryAgain = useCallback(() => {
    clearGenerationId();
    setSelectedShirt(null);
    setSelectedBackground(null);
    goToStep("shirt");
  }, [clearGenerationId, goToStep]);

  const handleBalanceUpdate = useCallback((newBalance: number) => {
    updateBalance(newBalance);
  }, [updateBalance]);

  const handleNoCredits = useCallback(() => {
    goToStep("buy-credits");
  }, [goToStep]);

  const handleRefreshBalance = useCallback(async () => {
    const newBalance = await fetchBalance();
    if (newBalance !== null) {
      updateBalance(newBalance);
    }
  }, [fetchBalance, updateBalance]);

  // Check if running inside admin preview
  const isAdminPreview = new URLSearchParams(window.location.search).get("preview") === "admin";

  // Loading state
  if (FANFRAME_ENABLED && !isAdminPreview && (authLoading || teamLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated
  if (FANFRAME_ENABLED && !isAdminPreview && !isAuthenticated) {
    return <AccessDeniedScreen />;
  }

  const effectiveBalance = isAdminPreview ? 999 : balance;
  const currentStepNumber = STEP_ORDER.indexOf(currentStep) + 1;
  const showStepIndicator = currentStep !== "welcome" && currentStep !== "result" && currentStep !== "history";

  // Apply team colors as CSS custom properties
  const teamColorStyles = team ? {
    '--team-primary': team.primary_color,
    '--team-secondary': team.secondary_color,
  } as React.CSSProperties : {};

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden" style={teamColorStyles}>
      {/* Credits Display */}
      {FANFRAME_ENABLED && !isAdminPreview && (
        <div className="fixed top-14 right-2 sm:top-16 sm:right-4 z-50 safe-right">
          <CreditsDisplay 
            balance={balance} 
            isLoading={creditsLoading}
            onRefresh={handleRefreshBalance}
          />
        </div>
      )}

      {showStepIndicator && (
        <StepIndicator 
          currentStep={currentStepNumber} 
          totalSteps={STEP_ORDER.length} 
          labels={STEP_LABELS}
        />
      )}
      
      {currentStep === "welcome" && (
        <WelcomeScreen 
          onStart={async () => {
            // Buscar saldo fresco ao iniciar
            const freshBalance = await fetchBalance();
            if (freshBalance !== null) {
              updateBalance(freshBalance);
            }
            const currentBalance = freshBalance ?? effectiveBalance;
            goToStep(FANFRAME_ENABLED && currentBalance <= 0 ? "buy-credits" : "tutorial");
          }}
          onHistory={() => goToStep("history")}
        />
      )}

      {currentStep === "buy-credits" && (
        <BuyCreditsScreen 
          balance={effectiveBalance}
          onRefreshBalance={handleRefreshBalance}
          isRefreshing={creditsLoading}
          onContinue={effectiveBalance > 0 ? () => goToStep("tutorial") : undefined}
          fetchBalance={fetchBalance}
        />
      )}

      {currentStep === "tutorial" && (
        <TutorialScreen 
          onContinue={() => goToStep("shirt")} 
          onBack={() => goToStep(FANFRAME_ENABLED && effectiveBalance <= 0 ? "buy-credits" : "welcome")}
        />
      )}

      {currentStep === "shirt" && (
        <ShirtSelectionScreen
          selectedShirt={selectedShirt}
          onSelectShirt={handleShirtSelect}
          onContinue={() => goToStep("background")}
          onBack={() => goToStep("tutorial")}
        />
      )}

      {currentStep === "background" && (
        <BackgroundSelectionScreen
          selectedBackground={selectedBackground}
          onSelectBackground={handleBackgroundSelect}
          onContinue={() => {
            if (effectiveBalance <= 0) {
              goToStep("buy-credits");
              return;
            }
            goToStep("upload");
          }}
          onBack={() => goToStep("shirt")}
        />
      )}

      {currentStep === "upload" && (
        <UploadScreen
          uploadedImage={uploadedImage}
          onImageUpload={handleImageUpload}
          onClearImage={handleClearImage}
          onContinue={async () => {
            // Sempre buscar saldo fresco antes de gerar
            const freshBalance = await fetchBalance();
            if (freshBalance !== null) {
              updateBalance(freshBalance);
            }
            const currentBalance = freshBalance ?? effectiveBalance;
            if (currentBalance <= 0) {
              goToStep("buy-credits");
              return;
            }
            goToStep("result");
          }}
          onBack={() => goToStep("background")}
        />
      )}

      {currentStep === "result" && selectedShirt && selectedBackground && uploadedImage && (
        <ResultScreen
          userImage={uploadedImage}
          selectedShirt={selectedShirt}
          selectedBackground={selectedBackground}
          balance={effectiveBalance}
          onTryAgain={handleTryAgain}
          onBalanceUpdate={handleBalanceUpdate}
          onNoCredits={handleNoCredits}
          onHistory={() => goToStep("history")}
        />
      )}

      {currentStep === "history" && (
        <HistoryScreen onBack={() => goToStep("welcome")} />
      )}
    </div>
  );
};

export default Index;
