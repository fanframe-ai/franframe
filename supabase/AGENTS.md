# Backend FanFrame

Funções compartilham apenas código em `functions/_shared`. `fanframe-proxy` autentica sessões por time; `generate-tryon` reserva; `replicate-webhook` valida assinatura; `generation-status` entrega resultado e confirma débito. Não aceite `team_id`, saldo ou URLs de asset enviados pelo cliente como autoridade.

Novas tabelas privadas devem ter RLS e políticas mínimas. RPCs de crédito devem ser transacionais, idempotentes, restritas a `service_role` e cobertas em `scripts/test-database.mjs`. Teste Edge com `npm run check:edge && npm run test:edge` e migrações em banco descartável com `npm run test:db`. Deploy e secrets seguem `docs/deployment.md`.
