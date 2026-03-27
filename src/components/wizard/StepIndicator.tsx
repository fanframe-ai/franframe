import { cn } from "@/lib/utils";
import { useTeam } from "@/contexts/TeamContext";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
}

export const StepIndicator = ({ currentStep, totalSteps, labels }: StepIndicatorProps) => {
  const { team } = useTeam();
  const pc = team?.primary_color || '#FFFFFF';

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-white/10 safe-top">
      <div className="max-w-2xl mx-auto px-4 py-1.5">
        {/* Progress bar */}
        <div className="relative h-0.5 bg-white/10 rounded-full overflow-hidden mb-1">
          <div 
            className="absolute top-0 left-0 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(currentStep / totalSteps) * 100}%`, backgroundColor: pc }}
          />
        </div>
        
        {/* Step dots and label */}
        <div className="flex items-center justify-between">
          {Array.from({ length: totalSteps }, (_, i) => {
            const stepNumber = i + 1;
            const isActive = stepNumber === currentStep;
            const isCompleted = stepNumber < currentStep;
            
            return (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-300",
                    !isActive && !isCompleted && "bg-white/20"
                  )}
                  style={{
                    ...(isActive ? { backgroundColor: pc, transform: 'scale(1.25)' } : {}),
                    ...(isCompleted ? { backgroundColor: pc, opacity: 0.6 } : {}),
                  }}
                />
                {labels && labels[i] && (
                  <span 
                    className={cn(
                      "text-[8px] uppercase tracking-wider transition-all duration-300",
                      "hidden sm:block",
                      isActive && "!block font-semibold",
                      !isActive && !isCompleted && "text-white/30"
                    )}
                    style={{
                      ...(isActive ? { color: pc } : {}),
                      ...(isCompleted ? { color: pc, opacity: 0.6 } : {}),
                    }}
                  >
                    {labels[i]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};