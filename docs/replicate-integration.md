# Geração de imagens com Replicate

O modelo usado é **ByteDance Seedream 5 Pro**, pela rota `bytedance/seedream-5-pro` da API do Replicate, definida em `supabase/functions/generate-tryon/index.ts`. A função aceita uma imagem JPG, PNG ou WEBP, um ID de camisa e um ID de cenário do time autenticado. A conversão HEIC ocorre no navegador antes do envio. O prompt vem do time ou de um padrão genérico.

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
