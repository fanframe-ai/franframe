# FanFrame

Leia o README antes de alterar fluxos. Mapa: `src/app` rotas; `src/features/tryon` provador; `teams` configuração pública; `auth` sessão/créditos; `admin` painel; `supabase/functions` APIs; `supabase/migrations` schema. Consulte `docs/architecture.md` e o guia específico da integração afetada.

- Preserve alterações locais preexistentes. Não edite migrações já aplicadas; crie uma nova e regenere `src/integrations/supabase/types.ts` após mudar schema.
- O frontend recebe apenas URL e chave pública do Supabase. Tokens Replicate, service role e segredos WordPress nunca entram em `VITE_`, código cliente ou logs.
- Todo acesso a geração, resultado e crédito depende de identidade validada por time. Use o UUID de geração como chave de idempotência. Mantenha fila e imagens de usuários privadas.
- Prefira a menor mudança que resolva o caso. Teste a lógica crítica com `npm run test:db`, `npm run test:edge` e `npm run test:e2e`; finalize com `npm run verify`.
- Deploy: siga `docs/deployment.md` e compare ambiente remoto antes de publicar.
