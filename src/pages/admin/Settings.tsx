import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, RotateCcw, Key, CheckCircle2, XCircle, Eye, EyeOff, ExternalLink } from "lucide-react";

const DEFAULT_PROMPT = `Virtual try-on: Transform this person to wear the Corinthians jersey (Timão).

RULES:
- Preserve the person's face, body proportions and pose exactly
- Replace only the upper body clothing with the Corinthians jersey
- Ensure realistic fabric folds and natural fit
- Place the person in the museum background setting
- Match lighting to indoor museum environment
- Maintain photorealistic quality, 8K resolution, sharp focus
- Professional DSLR camera quality`;

export default function AdminSettings() {
  const [prompt, setPrompt] = useState("");
  const [originalPrompt, setOriginalPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<"checking" | "valid" | "invalid" | "missing">("checking");
  const [showToken, setShowToken] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [isSavingToken, setIsSavingToken] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPrompt();
    checkTokenStatus();
  }, []);

  const loadPrompt = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "generation_prompt")
        .single();

      if (error) {
        console.error("Error loading prompt:", error);
        setPrompt(DEFAULT_PROMPT);
        setOriginalPrompt(DEFAULT_PROMPT);
      } else {
        setPrompt(data.value);
        setOriginalPrompt(data.value);
      }
    } catch (err) {
      console.error("Failed to load prompt:", err);
      setPrompt(DEFAULT_PROMPT);
      setOriginalPrompt(DEFAULT_PROMPT);
    } finally {
      setIsLoading(false);
    }
  };

  const checkTokenStatus = async () => {
    setTokenStatus("checking");
    try {
      const response = await fetch(
        "https://yxtglwbrdtwmxwrrhroy.supabase.co/functions/v1/health-check",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4dGdsd2JyZHR3bXh3cnJocm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNzg0NjUsImV4cCI6MjA4NTY1NDQ2NX0.l3VQIroGNVKYmGjfkZ7LNEHq1DuM2hxSo1M-yIuAxE4",
            apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4dGdsd2JyZHR3bXh3cnJocm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNzg0NjUsImV4cCI6MjA4NTY1NDQ2NX0.l3VQIroGNVKYmGjfkZ7LNEHq1DuM2hxSo1M-yIuAxE4",
          },
        }
      );

      const data = await response.json();
      
      if (data.results) {
        const replicateResult = data.results.find((r: any) => r.service_id === "replicate");
        if (replicateResult) {
          if (replicateResult.error_message?.includes("not configured")) {
            setTokenStatus("missing");
          } else if (replicateResult.status === "operational" || replicateResult.status === "degraded") {
            setTokenStatus("valid");
          } else {
            setTokenStatus("invalid");
          }
        } else {
          setTokenStatus("missing");
        }
      } else {
        setTokenStatus("missing");
      }
    } catch (err) {
      console.error("Failed to check token status:", err);
      setTokenStatus("missing");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("system_settings")
        .update({ value: prompt })
        .eq("key", "generation_prompt");

      if (error) {
        throw error;
      }

      setOriginalPrompt(prompt);
      toast({
        title: "Prompt salva",
        description: "A prompt foi atualizada com sucesso.",
      });
    } catch (err) {
      console.error("Failed to save prompt:", err);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a prompt. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setPrompt(DEFAULT_PROMPT);
  };

  const handleRevert = () => {
    setPrompt(originalPrompt);
  };

  const hasChanges = prompt !== originalPrompt;

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as configurações do sistema
          </p>
        </div>

        {/* Replicate Token Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Token Replicate
            </CardTitle>
            <CardDescription>
              Configure o token de API do Replicate para geração de imagens.
              O token é armazenado de forma segura nos secrets do Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Status:</span>
              {tokenStatus === "checking" && (
                <Badge variant="outline" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Verificando...
                </Badge>
              )}
              {tokenStatus === "valid" && (
                <Badge className="gap-1 bg-green-500">
                  <CheckCircle2 className="h-3 w-3" />
                  Configurado e válido
                </Badge>
              )}
              {tokenStatus === "invalid" && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Token inválido
                </Badge>
              )}
              {tokenStatus === "missing" && (
                <Badge variant="secondary" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Não configurado
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={checkTokenStatus}
                disabled={tokenStatus === "checking"}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-3">
              <p className="text-sm font-medium">Como configurar o token:</p>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>
                  Acesse o{" "}
                  <a
                    href="https://replicate.com/account/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Replicate Dashboard
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>Crie um novo token ou copie um existente</li>
                <li>
                  Acesse os{" "}
                  <a
                    href="https://supabase.com/dashboard/project/yxtglwbrdtwmxwrrhroy/settings/functions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Secrets do Supabase
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  Adicione ou atualize o secret <code className="bg-background px-1 rounded">REPLICATE_API_TOKEN</code>
                </li>
                <li>Clique em "Verificar" acima para confirmar</li>
              </ol>
            </div>

            {(tokenStatus === "missing" || tokenStatus === "invalid") && (
              <div className="p-4 border border-amber-500/30 bg-amber-500/10 rounded-lg">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  ⚠️ O token precisa ser configurado diretamente no painel do Supabase por questões de segurança.
                  Clique no link "Secrets do Supabase" acima para configurar.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prompt Card */}
        <Card>
          <CardHeader>
            <CardTitle>Prompt de Geração</CardTitle>
            <CardDescription>
              Prompt usada pelo modelo para gerar as imagens de try-on virtual.
              Alterações serão aplicadas nas próximas gerações.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={12}
                className="font-mono text-sm"
                placeholder="Digite a prompt de geração..."
              />
              <p className="text-xs text-muted-foreground">
                {prompt.length} caracteres
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar Alterações
              </Button>

              <Button
                variant="outline"
                onClick={handleRevert}
                disabled={!hasChanges}
              >
                Descartar Alterações
              </Button>

              <Button
                variant="ghost"
                onClick={handleReset}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restaurar Padrão
              </Button>
            </div>

            {hasChanges && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                ⚠️ Você tem alterações não salvas
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}