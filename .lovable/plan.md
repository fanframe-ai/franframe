

# Plano: Sistema Multi-Time (Multi-Tenant FanFrame)

## Objetivo
Transformar o FanFrame de um sistema single-tenant (apenas Corinthians) em um sistema multi-tenant onde cada time tem seu proprio subdominio, assets, configuracoes, chave Replicate e integracao WordPress independente.

## Arquitetura Proposta

```text
┌─────────────────────────────────────────────────────┐
│              ADMIN GLOBAL (/admin)                  │
│  Gerencia times, cria novos, configura cada um      │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┼──────────────────┐
        ▼              ▼                  ▼
  ┌──────────┐   ┌──────────┐      ┌──────────┐
  │corinthians│   │ saopaulo │      │  flamengo│  ...
  │.fanframe  │   │.fanframe │      │.fanframe │
  │  .app     │   │  .app    │      │  .app    │
  └──────────┘   └──────────┘      └──────────┘
  slug="corinthians"  slug="saopaulo"   slug="flamengo"
```

---

## Etapa 1 — Tabela `teams` (banco de dados)

Criar tabela central que armazena toda a configuracao de cada time:

```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,          -- "corinthians", "saopaulo"
  name TEXT NOT NULL,                 -- "Corinthians"
  subdomain TEXT UNIQUE NOT NULL,     -- "ffcorinthians" ou dominio customizado
  
  -- WordPress / FanFrame API
  wordpress_api_base TEXT NOT NULL,   -- "https://timaotourvirtual.com.br/wp-json/vf-fanframe/v1"
  purchase_urls JSONB DEFAULT '{}',   -- URLs de compra de creditos
  
  -- Replicate
  replicate_api_token TEXT,           -- Token Replicate exclusivo do time
  generation_prompt TEXT,             -- Prompt IA customizado
  
  -- Assets (JSONB com URLs das camisas, backgrounds, tutorial)
  shirts JSONB NOT NULL DEFAULT '[]',
  backgrounds JSONB NOT NULL DEFAULT '[]',
  tutorial_assets JSONB DEFAULT '{}',
  
  -- Branding
  primary_color TEXT DEFAULT '#000000',
  secondary_color TEXT DEFAULT '#FFFFFF',
  logo_url TEXT,
  watermark_url TEXT,
  
  -- Controle
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

Adicionar coluna `team_id` nas tabelas existentes: `generations`, `generation_queue`, `daily_stats`, `system_alerts`, `rate_limits`, `consent_logs`.

---

## Etapa 2 — Resolver o Time Atual (Frontend)

Criar um `TeamContext` (React Context) que identifica o time com base no subdominio ou slug na URL:

- `ffcorinthians.lovable.app` → slug = `corinthians`
- `ffsaopaulo.lovable.app` → slug = `saopaulo`
- Fallback: query param `?team=corinthians` para dev/preview

O contexto carrega a configuracao do time via query ao Supabase (`teams` table) e disponibiliza para toda a app: cores, assets, URLs, textos.

**Arquivos a criar/modificar:**
- `src/contexts/TeamContext.tsx` — novo contexto
- `src/hooks/useTeam.ts` — hook helper
- `src/App.tsx` — envolver app com `<TeamProvider>`
- `src/config/fanframe.ts` — remover constantes hardcoded, usar contexto

---

## Etapa 3 — Adaptar Componentes ao Time

Todos os componentes que hoje referenciam assets/textos hardcoded passam a consumir do `TeamContext`:

| Componente | O que muda |
|---|---|
| `ShirtSelectionScreen` | Camisas vem de `team.shirts` |
| `BackgroundSelectionScreen` | Backgrounds vem de `team.backgrounds` |
| `WelcomeScreen` | Nome do time, cores, logo |
| `TutorialScreen` | Imagens tutorial do time |
| `BuyCreditsScreen` | URLs de compra do time |
| `ResultScreen` | Watermark do time |
| `CreditsDisplay` | Cores do time |

---

## Etapa 4 — Edge Functions Multi-Tenant

### `fanframe-proxy`
- Receber `team_id` ou `team_slug` no body
- Buscar `wordpress_api_base` da tabela `teams`
- Rotear para a API WordPress correta do time

### `generate-tryon`
- Receber `team_id` no payload
- Buscar `replicate_api_token` e `generation_prompt` da tabela `teams`
- Usar token Replicate especifico do time
- Salvar `team_id` na `generation_queue`

### `replicate-webhook`
- Sem mudanca significativa (ja recebe queue_id que tem team_id)

---

## Etapa 5 — Painel Admin Multi-Time

Expandir o admin para gerenciar multiplos times:

1. **Tela "Times"** (`/admin/teams`) — lista todos os times, botao "Criar Novo Time"
2. **Formulario de Time** (`/admin/teams/:slug`) — editar configuracao completa:
   - Nome, slug, subdominio
   - URL da API WordPress
   - Token Replicate (campo seguro)
   - Upload de camisas e backgrounds
   - Prompt de geracao
   - Cores e branding
   - Ativar/desativar
3. **Filtro por time** nas telas existentes (Generations, Stats, Alerts)

---

## Etapa 6 — Migracao de Dados

Criar o time "corinthians" como primeiro registro com todos os dados atuais, para que nada quebre:

```sql
INSERT INTO teams (slug, name, subdomain, wordpress_api_base, ...)
VALUES ('corinthians', 'Corinthians', 'ffcorinthians', 
        'https://timaotourvirtual.com.br/wp-json/vf-fanframe/v1', ...);

UPDATE generations SET team_id = (SELECT id FROM teams WHERE slug = 'corinthians');
UPDATE generation_queue SET team_id = (SELECT id FROM teams WHERE slug = 'corinthians');
```

---

## Ordem de Implementacao Sugerida

1. Criar tabela `teams` + migrar dados do Corinthians
2. Criar `TeamContext` + resolver time por subdominio
3. Adaptar `fanframe-proxy` para multi-tenant
4. Adaptar `generate-tryon` para multi-tenant
5. Adaptar componentes do wizard para usar contexto
6. Criar tela admin de gerenciamento de times
7. Adicionar `team_id` nas tabelas existentes + filtros no admin

---

## Detalhes Tecnicos

- **Seguranca do token Replicate**: armazenado na tabela `teams` (acessivel apenas via service_role nas Edge Functions, protegido por RLS no frontend)
- **RLS**: politicas atualizadas para filtrar por `team_id` onde aplicavel
- **Subdominio**: resolvido via `window.location.hostname` no frontend
- **Backward compatibility**: o time "corinthians" sera criado automaticamente na migracao, garantindo que o sistema atual continue funcionando

