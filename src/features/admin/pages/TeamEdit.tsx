import { useState, useEffect, useCallback } from "react";
import { TestLinksManager } from "@/features/admin/components/TestLinksManager";
import { AssetCard } from "@/features/admin/components/AssetCard";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/features/admin/components/AdminLayout";
import { TeamIntegrationFields } from "@/features/admin/components/TeamIntegrationFields";
import { TeamShirtFields, TeamBackgroundFields } from "@/features/admin/components/TeamAssetFields";
import { emptyTeam, type TeamData, type ShirtItem, type BackgroundItem } from "@/features/admin/team-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Save, ArrowLeft, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useToast } from "@/components/ui/use-toast";


const generateHash = () => Math.random().toString(36).substring(2, 8);

export default function TeamEdit() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = slug === "novo";

  const [form, setForm] = useState<TeamData>(emptyTeam);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const loadTeam = useCallback(async (teamSlug: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("slug", teamSlug)
      .maybeSingle();

    if (error || !data) {
      toast({ title: "Time não encontrado", variant: "destructive" });
      navigate("/admin/teams");
      return;
    }

    const teamData: TeamData = {
      id: data.id,
      slug: data.slug,
      name: data.name,
      subdomain: data.subdomain,
      wordpress_api_base: data.wordpress_api_base,
      replicate_api_token: null,
      generation_prompt: data.generation_prompt,
      shirts: (data.shirts as unknown as ShirtItem[]) || [],
      backgrounds: (data.backgrounds as unknown as BackgroundItem[]) || [],
      tutorial_assets: (data.tutorial_assets as { before: string; after: string }) || { before: "", after: "" },
      primary_color: data.primary_color || "#000000",
      secondary_color: data.secondary_color || "#FFFFFF",
      logo_url: data.logo_url,
      watermark_url: data.watermark_url,
      is_active: data.is_active ?? true,
      text_overrides: (data.text_overrides as Record<string, string>) || {},
      purchase_urls: (data.purchase_urls as Record<string, string>) || {},
    };

    const { data: secret, error: secretError } = await supabase.from('team_secrets').select('replicate_api_token').eq('team_id', data.id).maybeSingle();
    if (secretError) {
      toast({ title: "Erro ao carregar credencial do time", variant: "destructive" });
      navigate("/admin/teams");
      return;
    }
    setForm({ ...teamData, replicate_api_token: secret?.replicate_api_token || null });
    setLoading(false);
  }, [navigate, toast]);

  useEffect(() => {
    if (!isNew && slug) void loadTeam(slug);
  }, [isNew, slug, loadTeam]);

  const updateField = <K extends keyof TeamData>(field: K, value: TeamData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // --- Shirts ---
  const addShirt = () => {
    const id = `camisa-${Date.now()}`;
    const newShirt: ShirtItem = {
      id,
      name: "",
      subtitle: "",
      imageUrl: "",
      assetPath: "",
      promptDescription: "",
      visible: true,
    };
    updateField("shirts", [...form.shirts, newShirt]);
  };

  const updateShirt = (index: number, updates: Partial<ShirtItem>) => {
    const shirts = [...form.shirts];
    shirts[index] = { ...shirts[index], ...updates };
    updateField("shirts", shirts);
  };

  const removeShirt = (index: number) => {
    updateField("shirts", form.shirts.filter((_, i) => i !== index));
  };

  // --- Backgrounds ---
  const addBackground = () => {
    const id = `cenario-${Date.now()}`;
    const newBg: BackgroundItem = {
      id,
      name: "",
      subtitle: "",
      imageUrl: "",
      assetPath: "",
      visible: true,
    };
    updateField("backgrounds", [...form.backgrounds, newBg]);
  };

  const updateBackground = (index: number, updates: Partial<BackgroundItem>) => {
    const bgs = [...form.backgrounds];
    bgs[index] = { ...bgs[index], ...updates };
    updateField("backgrounds", bgs);
  };

  const removeBackground = (index: number) => {
    updateField("backgrounds", form.backgrounds.filter((_, i) => i !== index));
  };

  // --- Save ---
  const handleSave = async () => {
    // Auto-fill required fields with defaults if empty
    const slug = form.slug || `time-${generateHash()}`;
    const name = form.name || "Novo Provador";
    const subdomain = form.subdomain || slug;

    const formToSave = { ...form, slug, name, subdomain };

    setSaving(true);

    const payload = {
      slug: formToSave.slug,
      name: formToSave.name,
      subdomain: formToSave.subdomain,
      wordpress_api_base: formToSave.wordpress_api_base?.trim().replace(/\/+$/, "") || null,
      generation_prompt: formToSave.generation_prompt || null,
      shirts: formToSave.shirts as unknown as Json,
      backgrounds: formToSave.backgrounds as unknown as Json,
      tutorial_assets: formToSave.tutorial_assets as unknown as Json,
      primary_color: formToSave.primary_color,
      secondary_color: formToSave.secondary_color,
      logo_url: formToSave.logo_url || null,
      watermark_url: formToSave.watermark_url || null,
      is_active: formToSave.is_active,
      text_overrides: formToSave.text_overrides as Json,
      purchase_urls: formToSave.purchase_urls as Json,
    };

    try {
      if (isNew) {
        const { data: created, error } = await supabase.from("teams").insert(payload).select('id').single();
        if (error) throw error;
        if (formToSave.replicate_api_token) {
          const { error: secretError } = await supabase.from('team_secrets').upsert({ team_id: created.id, replicate_api_token: formToSave.replicate_api_token });
          if (secretError) {
            await supabase.from('teams').delete().eq('id', created.id);
            throw secretError;
          }
        }
        toast({ title: "Time criado com sucesso!" });
        navigate("/admin/teams");
      } else {
        const { error } = await supabase.from("teams").update(payload).eq("id", form.id!);
        if (error) throw error;
        const { error: secretError } = await supabase.from('team_secrets').upsert({ team_id: form.id!, replicate_api_token: formToSave.replicate_api_token || null });
        if (secretError) throw secretError;
        toast({ title: "Time atualizado!" });
      }
    } catch (err: unknown) {
      toast({ title: "Erro ao salvar", description: err instanceof Error ? err.message : "Falha inesperada", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/teams")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {isNew ? "Criar Novo Provador" : `Editar: ${form.name}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isNew ? "Configure todos os detalhes do novo time" : `${window.location.host}/${form.slug}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => updateField("is_active", v)} />
              <span className="text-sm text-muted-foreground">{form.is_active ? "Ativo" : "Inativo"}</span>
            </div>
            {!isNew && form.slug && (
              <Button variant="outline" asChild>
                <a href={`${window.location.origin}/${form.slug}?preview=admin`} target="_blank" rel="noopener noreferrer">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </a>
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid grid-cols-8 w-full">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="integration">Integração</TabsTrigger>
            <TabsTrigger value="shirts">Camisas</TabsTrigger>
            <TabsTrigger value="backgrounds">Cenários</TabsTrigger>
            <TabsTrigger value="texts">Textos</TabsTrigger>
            <TabsTrigger value="tutorial">Tutorial</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="test-links">Links Teste</TabsTrigger>
          </TabsList>

          {/* === GERAL === */}
          <TabsContent value="general">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Time *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        updateField("name", name);
                        if (isNew) {
                          const base = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                          if (base) {
                            updateField("slug", `${base}-${generateHash()}`);
                          } else {
                            updateField("slug", "");
                          }
                        }
                      }}
                      placeholder="São Paulo FC"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug (URL) *</Label>
                    <Input
                      value={form.slug}
                      onChange={(e) => updateField("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      placeholder="saopaulo-a1b2c3"
                      disabled={!isNew}
                    />
                    <p className="text-xs text-muted-foreground">Gerado automaticamente com hash de segurança. Pode ser editado antes de salvar.</p>
                  </div>
                </div>
                {form.slug && (
                  <div className="space-y-2">
                    <Label>URL do Provador</Label>
                    <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
                      <span className="text-sm text-muted-foreground">{window.location.host}/</span>
                      <span className="text-sm font-medium">{form.slug}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">URL pública onde o provador será acessado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === INTEGRAÇÃO === */}
          <TabsContent value="integration">
            <TeamIntegrationFields value={form} onChange={updateField} />
          </TabsContent>

          {/* === CAMISAS === */}
          <TabsContent value="shirts">
            <TeamShirtFields slug={form.slug} shirts={form.shirts} onAdd={addShirt} onChange={updateShirt} onRemove={removeShirt} />
          </TabsContent>

          {/* === CENÁRIOS === */}
          <TabsContent value="backgrounds">
            <TeamBackgroundFields slug={form.slug} backgrounds={form.backgrounds} onAdd={addBackground} onChange={updateBackground} onRemove={removeBackground} />
          </TabsContent>

          {/* === TEXTOS === */}
          <TabsContent value="texts">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Textos do Provador</h2>
                  <p className="text-sm text-muted-foreground">
                    Personalize os textos exibidos em cada tela. Deixe vazio para usar o texto padrão.
                  </p>
                </div>

                {/* Welcome */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Tela Inicial</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input
                        value={form.text_overrides.welcome_title || ""}
                        onChange={(e) => updateField("text_overrides", { ...form.text_overrides, welcome_title: e.target.value || undefined })}
                        placeholder="VISTA A CAMISA"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Botão CTA</Label>
                      <Input
                        value={form.text_overrides.welcome_cta || ""}
                        onChange={(e) => updateField("text_overrides", { ...form.text_overrides, welcome_cta: e.target.value || undefined })}
                        placeholder="EXPERIMENTAR AGORA"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Subtítulo</Label>
                    <Input
                      value={form.text_overrides.welcome_subtitle || ""}
                      onChange={(e) => updateField("text_overrides", { ...form.text_overrides, welcome_subtitle: e.target.value || undefined })}
                      placeholder="IA que veste o manto do {time} em você. Resultado realista em segundos."
                    />
                    <p className="text-xs text-muted-foreground">Use {"{time}"} para inserir o nome do time automaticamente</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Prova Social</Label>
                    <Input
                      value={form.text_overrides.welcome_social_proof || ""}
                      onChange={(e) => updateField("text_overrides", { ...form.text_overrides, welcome_social_proof: e.target.value || undefined })}
                      placeholder="+ de 10.000 torcedores já vestiram"
                    />
                  </div>
                </div>

                {/* Tutorial */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Tela Tutorial</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input
                        value={form.text_overrides.tutorial_title || ""}
                        onChange={(e) => updateField("text_overrides", { ...form.text_overrides, tutorial_title: e.target.value || undefined })}
                        placeholder="Como funciona"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Subtítulo</Label>
                      <Input
                        value={form.text_overrides.tutorial_subtitle || ""}
                        onChange={(e) => updateField("text_overrides", { ...form.text_overrides, tutorial_subtitle: e.target.value || undefined })}
                        placeholder="Em 3 passos, você se vê vestindo o manto."
                      />
                    </div>
                  </div>
                </div>

                {/* Shirt Selection */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Seleção de Camisa</h3>
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input
                      value={form.text_overrides.shirt_title || ""}
                      onChange={(e) => updateField("text_overrides", { ...form.text_overrides, shirt_title: e.target.value || undefined })}
                      placeholder="Qual manto você vai vestir?"
                    />
                  </div>
                </div>

                {/* Background Selection */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Seleção de Cenário</h3>
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input
                      value={form.text_overrides.background_title || ""}
                      onChange={(e) => updateField("text_overrides", { ...form.text_overrides, background_title: e.target.value || undefined })}
                      placeholder="Escolha o cenário"
                    />
                  </div>
                </div>

                {/* Upload */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Tela de Upload</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input
                        value={form.text_overrides.upload_title || ""}
                        onChange={(e) => updateField("text_overrides", { ...form.text_overrides, upload_title: e.target.value || undefined })}
                        placeholder="Agora, sua foto"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Subtítulo</Label>
                      <Input
                        value={form.text_overrides.upload_subtitle || ""}
                        onChange={(e) => updateField("text_overrides", { ...form.text_overrides, upload_subtitle: e.target.value || undefined })}
                        placeholder="Corpo inteiro, roupa clara"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Botão CTA</Label>
                    <Input
                      value={form.text_overrides.upload_cta || ""}
                      onChange={(e) => updateField("text_overrides", { ...form.text_overrides, upload_cta: e.target.value || undefined })}
                      placeholder="VESTIR O MANTO"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === TUTORIAL === */}
          <TabsContent value="tutorial">
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Imagens do Tutorial</h2>
                <p className="text-sm text-muted-foreground">Antes e depois exibidos no tutorial do provador</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AssetCard
                  label="Imagem Antes"
                  subtitle="Foto de exemplo sem a camisa"
                  currentUrl={form.tutorial_assets?.before || "/placeholder.svg"}
                  storagePath={`${form.slug}/tutorial/before.jpg`}
                  aspectRatio="3/4"
                  onImageUploaded={(url) =>
                    updateField("tutorial_assets", { ...form.tutorial_assets, before: url })
                  }
                />
                <AssetCard
                  label="Imagem Depois"
                  subtitle="Foto de exemplo com a camisa"
                  currentUrl={form.tutorial_assets?.after || "/placeholder.svg"}
                  storagePath={`${form.slug}/tutorial/after.png`}
                  aspectRatio="3/4"
                  onImageUploaded={(url) =>
                    updateField("tutorial_assets", { ...form.tutorial_assets, after: url })
                  }
                />
              </div>
            </div>
          </TabsContent>

          {/* === BRANDING === */}
          <TabsContent value="branding">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cor Primária</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={form.primary_color}
                        onChange={(e) => updateField("primary_color", e.target.value)}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input value={form.primary_color} onChange={(e) => updateField("primary_color", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor Secundária</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={form.secondary_color}
                        onChange={(e) => updateField("secondary_color", e.target.value)}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input value={form.secondary_color} onChange={(e) => updateField("secondary_color", e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Color preview */}
                <div className="flex gap-4">
                  <div
                    className="rounded-lg h-20 flex-1 flex items-center justify-center text-white font-bold text-lg shadow-sm"
                    style={{ backgroundColor: form.primary_color, color: form.secondary_color }}
                  >
                    {form.name || "Nome do Time"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <Label>Logo do Time</Label>
                    <AssetCard
                      label="Logo"
                      subtitle="Exibido no topo do provador"
                      currentUrl={form.logo_url || "/placeholder.svg"}
                      storagePath={`${form.slug}/branding/logo.png`}
                      aspectRatio="1/1"
                      onImageUploaded={(url) => updateField("logo_url", url)}
                      onRemove={form.logo_url ? () => updateField("logo_url", null) : undefined}
                    />
                  </div>
                  <div className="space-y-4">
                    <Label>Marca d'água</Label>
                    <AssetCard
                      label="Watermark"
                      subtitle="Aplicada nas imagens geradas"
                      currentUrl={form.watermark_url || "/placeholder.svg"}
                      storagePath={`${form.slug}/branding/watermark.webp`}
                      aspectRatio="1/1"
                      onImageUploaded={(url) => updateField("watermark_url", url)}
                      onRemove={form.watermark_url ? () => updateField("watermark_url", null) : undefined}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === LINKS DE TESTE === */}
          <TabsContent value="test-links">
            {form.id ? (
              <TestLinksManager teamId={form.id} teamSlug={form.slug} />
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Salve o provador primeiro para criar links de teste.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
