# Deploy

O frontend é uma SPA Vite. `vercel.json` reescreve rotas para `index.html`; a Vercel deve usar `npm ci`, `npm run build` e `dist`. Defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no projeto Vercel para cada ambiente. `VITE_SUPABASE_PROJECT_ID` não é necessário: o ID é derivado da URL.

O deploy automático da `main` foi liberado após aplicar a migração de segurança e publicar as funções compatíveis. `vercel.json` contém somente a URL e a chave pública do Supabase em `env`, para o build não depender de arquivos `.env` locais. Para usar outro projeto em um ambiente de preview, ajuste esses dois valores públicos explicitamente. Secrets de servidor continuam fora dessa configuração.

As funções e migrações pertencem ao projeto indicado em `supabase/config.toml`. Antes de publicar:

1. Rode `npm run verify` e `supabase db reset --local` em ambiente com Docker. Faça backup do banco de destino e inspecione `supabase db push --dry-run --linked`. No projeto atualmente vinculado, a simulação está bloqueada pela divergência histórica descrita abaixo; reconcilie-a antes de qualquer push.
2. Configure secrets privados com `supabase secrets set REPLICATE_API_TOKEN=... ADMIN_SETUP_KEY=... --project-ref <ref>` ou pela interface do Supabase. Tokens próprios de time são armazenados em `team_secrets` pelo painel admin. Não inclua secrets no `.env` do Vite.
3. Após uma simulação sem divergências e um backup conferido, aplique as migrações pendentes com `supabase db push --linked`. A migração `20261008210000_secure_generation_workflow.sql` torna `tryon-temp` privado, move tokens de times e muda políticas/RPCs; ela deve entrar antes da nova versão do frontend.
4. Defina `SUPABASE_PROJECT_REF=<ref>` e execute `npm run functions:deploy`. O script implanta apenas as sete funções versionadas, incluindo `generation-worker`, a partir dos arquivos reais. Não usa `--prune`.
5. Publique o frontend na Vercel, teste login admin, time ativo/inativo, link de teste, geração, webhook e compra por time. Confira logs sem dados sensíveis.

`create-first-admin` exige `ADMIN_SETUP_KEY` e só funciona sem papel admin existente. Após o primeiro admin, remova ou rotacione esse secret. O health check exige JWT de administrador; o webhook Replicate usa assinatura do provedor e não aceita JWT de usuário.

Para a fila durável, o health check também aceita a credencial privada do worker. Siga [a operação do lançamento](launch-operations.md) para secrets/Vault/Cron, readback de HTTP e liberação conservadora. A migração `20261009180000_durable_generation_queue.sql` nasce com novas gerações pausadas. Ativar somente após publicar o worker, testar Cron e confirmar capacidade/quotas; consulta e recuperação de resultados continuam disponíveis durante pausas.

Reversão: restaure primeiro a versão anterior do frontend/Edge Functions. Para migrações, use uma migração corretiva após avaliar dados existentes; não execute rollback automático de tabelas de sessão, créditos ou imagens. Antes de aposentar funções remotas não versionadas, confirme chamadas, webhooks e dependências externos. O inventário em 8/10/2026 encontrou `create-delivery-link`, `create-kiosk-payment`, `manage-admin-users`, `pagbank-webhook` e `deploy-functions` implantadas além das funções deste repositório. Excluí-las requer investigação separada; o script de deploy não as toca.

A URL [franframe.vercel.app](https://franframe.vercel.app) respondeu durante esta revisão. Confirme no painel Vercel qual branch, projeto e domínio recebe cada deploy antes de divulgar como produção.

## Divergência de migrações no projeto vinculado

Em 8/10/2026, `supabase db push --dry-run --linked` parou antes de aplicar SQL. As quinze migrações locais de janeiro/fevereiro não constam na tabela remota de histórico. Dez migrações de março constam remotamente com timestamps 2–3 segundos anteriores aos arquivos locais; `supabase migration fetch --linked` mostrou SQL equivalente, descontando um `;` extra no fim. Os pares são `20260311194604/07`, `20260312161415/17`, `20260321172234/36`, `20260321172312/14`, `20260321175712/14`, `20260324170904/06`, `20260330220220/23`, `20260330220559/20260330220601`, `20260330220912/15` e `20260330235224/27` (remoto/local). A migração remota `20260509013953`, que removeu colunas WordPress, foi recuperada em `supabase/migrations`; a migração de 8/10 às 19:50 consta nos dois históricos. Uma consulta read-only confirmou que `purchase_urls` está ausente no schema remoto; a nova migração de segurança recria a coluna. Ela ainda não está remota.

Antes de reparar o histórico, obtenha um backup de schema e dados, compare o schema remoto com o resultado do replay local e confira a tabela `supabase_migrations.schema_migrations`. Não use `migration repair` às cegas, nem faça push das migrações antigas duplicadas; ambos podem deixar o histórico afirmando mudanças que não existem. O histórico antigo permanece divergente no checkout e precisa de uma revisão própria; o deploy abaixo não o reescreveu.

## Aplicação de segurança em 8/10/2026

Foi criado um dump PostgreSQL nativo em formato custom dos schemas `public`, `auth`, `storage` e `supabase_migrations`, com 47 tabelas e manifesto de contagens/hash, fora do Git e com permissões privadas. A restauração dos dados públicos e usuários necessários em banco descartável preservou as contagens. A migração passou nessa cópia, incluindo preservação dos tokens por time, bucket privado, negação de RPC anônima e reserva/devolução idempotente de crédito de teste. O caminho de extensões foi considerado na migração antes de sua aplicação; não edite esse arquivo depois de aplicado.

Para não repetir SQL antigo ou modificar registros históricos, o histórico real foi recuperado com `supabase migration fetch --linked` em um diretório temporário vinculado ao mesmo projeto. Os doze arquivos recuperados conferiram com seus correspondentes locais, descontando comandos vazios no fim. Apenas `20261008210000_secure_generation_workflow.sql` foi acrescentado a esse diretório. O `db push --dry-run --linked --workdir <diretorio>` listou somente essa migração; o push real a aplicou e registrou. As contagens de registros e os fingerprints de tokens/configuração são conferidos depois do deploy.

As seis funções versionadas foram publicadas sem remover nem atualizar as funções extras. O script usa `--import-map supabase/functions/deno.json`, que resolve dependências com `nodeModulesDir: auto`, pois o servidor de empacotamento não recebe o `node_modules` local. A configuração Deno da raiz continua usando `manual` nos testes locais, para não substituir a árvore npm do frontend. Testes de requests sem identidade válida não geram imagem nem debitam créditos. A instalação do ZIP em `wordpress/` e o teste com código WordPress novo continuam a cargo do administrador daquele site; o deploy deste repositório não instala plugins WordPress.

## Status e origem WordPress em 9/10/2026

As migrações `20261009200000_precise_health_monitoring.sql` e `20261009203000_wordpress_site_provenance.sql` foram aplicadas pelo diretório de histórico remoto recuperado, após backups PostgreSQL privados e dry-runs que listaram somente cada migração nova. O histórico de health checks foi preservado; os fingerprints de identidade, hashes e expiração das sessões existentes permaneceram iguais, e sua origem principal foi fixada. Os tipos foram regenerados com postgres-meta após replay de 31 migrações.

São Paulo mantém `spfc.virtualfans.com.br` como principal e `tricolorvirtualexperience.net` como origem adicional, com checkout e preços próprios. As sete funções versionadas foram publicadas sem remover funções extras. Readbacks confirmaram os seis serviços operacionais, rejeição de origem não configurada com 400, health check público negado com 401 e custos positivos registrados de 9 centavos. Não houve geração paga neste deploy. O frontend correspondente precisa ser publicado para enviar a origem do handoff e usar o checkout validado por sessão; alterar o Supabase não publica a SPA nem configura o destino do plugin WordPress.

A migração adicional `20261009204500_preserve_wordpress_primary_identity.sql` impede redirecionar a base principal quando existem identidades WordPress. Foi aplicada após novo backup e dry-run isolado; configurações e sessões ficaram idênticas. O replay local inclui 32 migrações e testa tanto a rejeição da troca quanto o salvamento administrativo normal sem acesso direto às sessões privadas.

## Retenção de Picos em 9/10/2026

A migração `20261009213000_peak_generation_retention.sql` foi aplicada após backup privado e dry-run contendo apenas esse arquivo, pelo histórico remoto recuperado. A capacidade foi ampliada para 60 aguardando; readback preservou 6 slots, 9 envios/minuto, margem de 10% e tetos US$ 300/US$ 300. Identidades, sites e pedidos existentes permaneceram iguais. O worker permite até 30 minutos para entradas prontas, mantendo 10 minutos para uploads incompletos e sem encerrar envios incertos como se não tivessem sido aceitos.

A função `generation-status` foi publicada com consulta autenticada de disponibilidade sem upload/reserva e fases reais de preparação/geração/finalização. A consulta sem identidade válida foi rejeitada. O frontend foi verificado localmente com 35 testes de navegador, 17 Edge e replay de 33 migrações, incluindo disputa por 60 vagas e seis slots. A nova tela e a retentativa automática ainda precisam ser publicadas na Vercel; não houve geração paga nem teste de carga sustentada no provedor nessa aplicação.
