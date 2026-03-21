
## Plano: Sistema Multi-Time (Multi-Tenant FanFrame) — IMPLEMENTADO

### O que foi feito

1. **Tabela `teams`** criada no Supabase com todos os campos (slug, subdomain, wordpress_api_base, replicate_api_token, generation_prompt, shirts, backgrounds, tutorial_assets, branding, etc.)
2. **Coluna `team_id`** adicionada em: generations, generation_queue, daily_stats, system_alerts, consent_logs
3. **Corinthians** seedado como primeiro time com todos os dados atuais
4. **`TeamContext`** (`src/contexts/TeamContext.tsx`) resolve o time pelo subdomínio (ff<slug>.lovable.app) ou query param `?team=<slug>`
5. **Componentes adaptados**: WelcomeScreen, TutorialScreen, ShirtSelectionScreen, BackgroundSelectionScreen, BuyCreditsScreen, ResultScreen — todos usam dados dinâmicos do TeamContext
6. **Edge Functions atualizadas**: `fanframe-proxy` resolve `wordpress_api_base` por time; `generate-tryon` usa token Replicate e prompt por time
7. **Hooks atualizados**: useFanFrameAuth e useFanFrameCredits passam `team_slug` nas chamadas
8. **Admin: Tela "Times"** (`/admin/teams`) para criar, editar e desativar times com formulário completo (integração, assets JSON, branding)
9. **RLS**: times públicos podem ser lidos por anon/authenticated; admins podem gerenciar
