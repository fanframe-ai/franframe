# Desenvolvimento

Use Node 24 (`.nvmrc`), npm 11, Supabase CLI e Docker para a stack local. `npm ci` é a instalação canônica. Copie `.env.example` para `.env.local` e preencha apenas URL e chave pública do Supabase. `supabase start`, `supabase db reset --local` e `supabase status` criam o banco local e exibem as credenciais públicas. Em outro terminal, `npm run dev` inicia Vite na porta 8080.

Para funções locais, crie `supabase/functions/.env.local` com `REPLICATE_API_TOKEN`, `ADMIN_SETUP_KEY` e, quando necessário, configuração fornecida pelo CLI. Execute `npm run functions:serve`. Nunca use chaves de produção em fixtures. Um teste de interface completo pode usar um link de teste criado por um administrador, com crédito limitado; testes automatizados usam mocks e não chamam Replicate ou WordPress.

Comandos principais:

| Comando | Verificação |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript frontend e Vite |
| `npm test` | Vitest |
| `npm run check:edge` | Tipos das Edge Functions no Deno |
| `npm run test:edge` | Assinatura e validação de requisições |
| `npm run test:db` | 28 migrações, RLS e idempotência num PostgreSQL descartável |
| `npm run test:e2e` | Rotas e autenticação simuladas no Chromium |
| `npm run verify` | Todas as verificações e build |

`npm run test:db` aceita `TEST_DATABASE_URL`; por padrão usa `postgres://localhost:55432/postgres`. Ele cria e apaga apenas um banco com nome `fanframe_test_<PID>`. Requer papéis de teste e `CREATE DATABASE`. O replay usa fixture mínima para `auth` e `storage`; ignora as extensões hospedadas `pg_cron` e `pg_net`, indisponíveis no PostgreSQL puro. Antes de produção, valide também `supabase db reset --local` e `supabase db push --dry-run --linked` no ambiente Supabase real.

Após mudar schema, crie uma nova migração e execute `npm run db:reset && npm run db:types`. A migração antiga que vincula um super admin a um UUID específico precisa de um usuário correspondente no ambiente onde foi aplicada; o teste descartável cria esse usuário explicitamente. Em um novo projeto, substitua esse bootstrap por `create-first-admin` com `ADMIN_SETUP_KEY` e revise a migração de seed antes do primeiro push.

Pendências conhecidas: o lint conclui sem erros, mas emite três avisos de Fast Refresh nos exports compartilhados de `badge`, `button` e `TeamContext`. O build avisa sobre o chunk principal e o conversor HEIC carregado sob demanda. `npm audit --omit=dev` não encontra vulnerabilidades; a auditoria completa aponta nove ocorrências em dependências de desenvolvimento da cadeia Tailwind 3. Uma atualização para Tailwind 4 exige validar estilos e componentes separadamente.
