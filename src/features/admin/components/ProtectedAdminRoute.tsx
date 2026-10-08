import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAdminAuth } from "@/features/auth/hooks/useAdminAuth";
import { Loader2 } from "lucide-react";

interface ProtectedAdminRouteProps {
  children: ReactNode;
}

export function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const { isAuthenticated, isAdmin, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🚫</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground mb-6">
            Você não tem permissão para acessar o painel administrativo.
          </p>
          <a
            href="/"
            className="text-primary hover:underline"
          >
            Voltar para o início
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
