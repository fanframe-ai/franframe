# Geração de imagens com Replicate

O modelo usado é **ByteDance Seedream 5 Pro**, pela rota `bytedance/seedream-5-pro` da API do Replicate, definida em `supabase/functions/_shared/prediction.ts` e consumida pelo worker. `generate-tryon` aceita uma imagem JPG, PNG ou WEBP, um ID de camisa e um ID de cenário do time autenticado e reserva trabalho na fila. A conversão HEIC ocorre no navegador antes do envio. O prompt vem do time ou de um padrão genérico e é congelado no pedido antes do despacho.

O prompt revisado do São Paulo está versionado em [prompts/virtual-tryon.txt](prompts/virtual-tryon.txt) e foi configurado em `teams.generation_prompt` em 9/10/2026. A ordem das referências é foto do usuário, camisa e cenário. A configuração permanece `size: 2K`, `aspect_ratio: match_input_image`, `output_format: png`; o texto não aumenta a resolução. Alterar o arquivo não atualiza o banco automaticamente: o campo do time é a configuração efetiva, editável no painel admin. O prompt anterior foi preservado em backup privado antes da atualização.

A [pesquisa de prompts](seedream-prompt-notes.md) registra fontes oficiais, decisões e limitações. As instruções pedem identidade preservada, detalhes da camisa copiados da referência e mínima alteração do cenário, sem prometer cópia pixel a pixel. A atualização foi conferida por leitura do banco e da configuração pública; a qualidade visual precisa de comparação real autorizada, pois uma geração consome recursos do provedor. Outros times e o prompt genérico não foram alterados.

O token Replicate de cada time está em `team_secrets.replicate_api_token`, visível apenas ao painel admin e à Edge Function. `REPLICATE_API_TOKEN` é fallback privado para times sem token próprio. O navegador nunca recebe esses valores. O endpoint de geração valida identidade, consentimento, tamanho/tipo da foto e IDs de assets; usa o UUID de requisição para reservar crédito e impedir duplicação.

Fluxo:

1. `generate-tryon` grava a foto em `tryon-temp` privado e cria URL assinada temporária.
2. O backend busca a chave de assinatura de webhook no Replicate e cria uma prediction com foto, camisa e cenário.
3. `replicate-webhook` lê o corpo bruto e verifica `webhook-id`, `webhook-timestamp` e `webhook-signature` com HMAC-SHA256. O timestamp deve estar no intervalo de cinco minutos; o ID da prediction deve coincidir com o job.
4. Na conclusão, a função baixa apenas saídas HTTPS do domínio de entrega do Replicate, grava o resultado no bucket privado e chama `finish_generation`. Chamadas repetidas não consomem crédito extra. Falhas chamam `fail_generation`, que devolve a reserva de teste.
5. O frontend consulta `generation-status`, que autentica dono/time, reconcilia o débito WordPress e entrega URL assinada válida por cinco minutos.

O bucket `tryon-assets` continua público para imagens de referência dos times, mas upload/atualização exige admin. O bucket `tryon-temp` é privado. O frontend não assina URLs nem lê diretamente a fila. O painel administrativo lê métricas via políticas admin.

Verificações locais: `npm run check:edge`, `npm run test:edge`, `npm run test:db` e `npm run test:e2e`. O teste Deno cobre assinatura alterada/expirada e tentativa de usar asset de outro time; o teste PostgreSQL cobre idempotência e crédito de teste. Um smoke test real em homologação exige token Replicate válido, webhook alcançável e um link de teste, pois gera custo.

Referências: [API de predictions do Replicate](https://replicate.com/docs/topics/predictions/create-a-prediction), [verificação de webhook](https://replicate.com/docs/topics/webhooks/verify-webhook), [modelo Seedream 5 Pro](https://replicate.com/bytedance/seedream-5-pro).
