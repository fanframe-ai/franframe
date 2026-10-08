# Reorganização do repositório FanFrame

Registro da execução do plano de 8/10/2026. O diagnóstico original foi preservado fora do checkout versionado pela verificação local de conclusão. O estado atual e os comandos executáveis estão no [README](../../README.md).

| Área | Entrega |
| --- | --- |
| Base | npm com `package-lock.json`, Node 24, `.editorconfig`, ambiente público por variáveis e scripts de verificação |
| Identidade | README, metadados, imagem social e documentação próprios do FanFrame |
| Backend | Secrets por time fora da tabela pública, políticas RLS restritas, bucket temporário privado, sessões por time, RPCs transacionais e webhook assinado |
| Produto | Checkout por time, créditos no servidor, consentimento persistido, rota de upload administrativa, status autenticado e downloads compartilhados |
| Estrutura | `src/app`, `src/features/{tryon,teams,auth,admin}`, utilitários Edge compartilhados e remoção de arquivos e assets sem uso |
| Fluxo Codex | `AGENTS.md` de raiz e backend, guias de arquitetura/desenvolvimento/deploy e CI |
| Validação | Vitest, Deno, replay de migrações/RLS em PostgreSQL descartável, Playwright, lint, tipos e build |

O deploy remoto deve seguir [docs/deployment.md](../deployment.md). A simulação do push identificou uma divergência entre o histórico de migrações local e o remoto; ela precisa ser reconciliada com backup antes da publicação. Funções remotas sem origem neste repositório foram inventariadas e não são removidas automaticamente. Mudanças de banco e funções devem ser publicadas antes da nova versão da SPA. O teste de geração com custo requer um ambiente de homologação com credenciais próprias.
