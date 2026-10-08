# FanFrame

Provador virtual multi-time. O visitante escolhe camisa e cenário, envia uma foto e recebe uma imagem gerada com IA. O painel administrativo gerencia times, assets, links de teste e operação.

**Stack:** React 18, TypeScript, Vite 6, React Router 7, Tailwind CSS 3, Supabase (PostgreSQL, Auth, Storage e Edge Functions em Deno), WordPress para sessões e créditos, Replicate com `bytedance/seedream-5-pro` para imagens. A hospedagem web usa Vercel com rewrite de SPA.

## Começar

Requer Node 24, npm 11 e Supabase CLI. Docker é necessário para iniciar a stack Supabase completa localmente.

```sh
nvm use
npm ci
cp .env.example .env.local
supabase start
supabase db reset --local
```

Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em `.env.local` com os valores públicos mostrados por `supabase status`. Configure os secrets das funções em `supabase/functions/.env.local` conforme [desenvolvimento](docs/development.md). Depois execute `npm run dev` e acesse `http://localhost:8080`. O modo de teste usa um link criado em `/admin/teams/:slug`, sem saldo WordPress.

```sh
npm run verify       # lint, tipos, testes, Edge Functions, build, navegador e inspeção do repositório
npm run test:db      # replay de migrações e transações em PostgreSQL descartável
npm run db:types     # regenera tipos após alterar o schema local
```

`npm run test:db` aceita `TEST_DATABASE_URL` apontando para um PostgreSQL descartável com permissão para criar bancos; o padrão é `postgres://localhost:55432/postgres`. O CI inicia esse serviço automaticamente. A aplicação precisa das tabelas e funções da última migração antes que o frontend e as Edge Functions desta versão sejam publicados.

## Mapa

- [Arquitetura e limites de segurança](docs/architecture.md)
- [Desenvolvimento, testes e fixtures](docs/development.md)
- [Deploy, secrets e reversão](docs/deployment.md)
- [Contrato WordPress](docs/wordpress-integration.md)
- [Plugin WordPress corrigido e teste de login](wordpress/README.md)
- [Geração e webhook Replicate](docs/replicate-integration.md)
- [Design system](docs/design-system.md)
- [Instruções para Codex](AGENTS.md)

O projeto Supabase versionado em `supabase/config.toml` é `qmjvsftlounkitclmzzw`. A URL de produção documentada é [franframe.vercel.app](https://franframe.vercel.app); confirme o ambiente selecionado antes de publicar. `.env` e `.env.local` são arquivos locais e nunca devem conter service role ou tokens Replicate com prefixo `VITE_`.
