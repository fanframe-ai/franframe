export interface ShirtItem {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  assetPath: string;
  promptDescription: string;
  visible: boolean;
}

export interface BackgroundItem {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  assetPath: string;
  visible: boolean;
}

export interface TeamData {
  id?: string;
  slug: string;
  name: string;
  subdomain: string;
  wordpress_api_base: string | null;
  wordpress_sites?: { api_base: string; purchase_urls?: Record<string, string> }[];
  replicate_api_token: string | null;
  generation_prompt: string | null;
  shirts: ShirtItem[];
  backgrounds: BackgroundItem[];
  tutorial_assets: { before: string; after: string };
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  watermark_url: string | null;
  is_active: boolean;
  text_overrides: Record<string, string>;
  purchase_urls: Record<string, string>;
}

export const emptyTeam: TeamData = {
  slug: "",
  name: "",
  subdomain: "",
  wordpress_api_base: null,
  wordpress_sites: [],
  replicate_api_token: null,
  generation_prompt: null,
  shirts: [],
  backgrounds: [],
  tutorial_assets: { before: "", after: "" },
  primary_color: "#000000",
  secondary_color: "#FFFFFF",
  logo_url: null,
  watermark_url: null,
  is_active: true,
  text_overrides: {
    welcome_title: "VISTA A CAMISA",
    welcome_cta: "EXPERIMENTAR AGORA",
    welcome_subtitle: "IA que veste o manto do {time} em você. Resultado realista em segundos.",
    welcome_social_proof: "+ de 10.000 torcedores já vestiram",
    tutorial_title: "Como funciona",
    tutorial_subtitle: "Em 3 passos, você se vê vestindo o manto.",
    shirt_title: "Qual manto você vai vestir?",
    background_title: "Escolha o cenário",
    upload_title: "Agora, sua foto",
    upload_subtitle: "Corpo inteiro, roupa clara",
    upload_cta: "ENVIAR FOTO",
  },
  purchase_urls: {},
};
