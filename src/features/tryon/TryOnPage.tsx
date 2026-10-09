import { useState, useEffect, useCallback } from "react";
import { WelcomeScreen } from "@/features/tryon/components/WelcomeScreen";
import { TutorialScreen } from "@/features/tryon/components/TutorialScreen";
import { ShirtSelectionScreen } from "@/features/tryon/components/ShirtSelectionScreen";
import { BackgroundSelectionScreen } from "@/features/tryon/components/BackgroundSelectionScreen";
import { UploadScreen } from "@/features/tryon/components/UploadScreen";
import { ResultScreen } from "@/features/tryon/components/ResultScreen";
import { BuyCreditsScreen } from "@/features/tryon/components/BuyCreditsScreen";
import { HistoryScreen } from "@/features/tryon/components/HistoryScreen";
import { AccessDeniedScreen } from "@/features/tryon/components/AccessDeniedScreen";
import { StepIndicator } from "@/features/tryon/components/StepIndicator";
import { CreditsDisplay } from "@/features/auth/CreditsDisplay";
import { useFanFrameAuth } from "@/features/auth/hooks/useFanFrameAuth";
import { useFanFrameCredits } from "@/features/auth/hooks/useFanFrameCredits";
import { useTestToken } from "@/features/auth/hooks/useTestToken";
import { FANFRAME_ENABLED } from "@/config/fanframe";
import { useTeam, type TeamShirt, type TeamBackground } from "@/features/teams/TeamContext";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

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
  } = useFanFrameCredits(logout);

  const {
    isTestMode,
    testBalance,
    isLoading: testTokenLoading,
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
    setSelectedShirt(null);
    setSelectedBackground(null);
    goToStep("shirt");
  }, [goToStep]);

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

  // Loading state — never render the wizard before the team config is resolved
  if (
    teamLoading ||
    (FANFRAME_ENABLED && !isAdminPreview && !isTestMode && (authLoading || testTokenLoading))
  ) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated (skip auth check for test mode and admin preview)
  if (FANFRAME_ENABLED && !isAdminPreview && !isTestMode && !isAuthenticated) {
    return <AccessDeniedScreen />;
  }

  const effectiveBalance = isAdminPreview ? 999 : isTestMode ? testBalance : balance;
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
      {(FANFRAME_ENABLED || isTestMode) && !isAdminPreview && (
        <div className="fixed top-14 right-2 sm:top-16 sm:right-4 z-50 safe-right">
          <CreditsDisplay 
            balance={effectiveBalance} 
            isLoading={isTestMode ? false : creditsLoading}
            onRefresh={isTestMode ? refreshTestBalance : handleRefreshBalance}
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
            // Selection can start with confirmed credits; the server still validates before generation.
            if (isAdminPreview || effectiveBalance > 0 || !FANFRAME_ENABLED) {
              goToStep("tutorial");
              return;
            }
            if (isTestMode) {
              await refreshTestBalance();
              goToStep(testBalance <= 0 ? "buy-credits" : "tutorial");
              return;
            }
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
            if (isTestMode) {
              await refreshTestBalance();
              if (testBalance <= 0) {
                goToStep("buy-credits");
                return;
              }
              goToStep("result");
              return;
            }
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
