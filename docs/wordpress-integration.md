# Contrato WordPress ↔ FanFrame

Cada time tem `wordpress_api_base` e `purchase_urls` em `teams`. O backend lê a URL daquele time; nenhuma rota usa um site padrão de outro clube. O navegador envia `team_slug` para `fanframe-proxy`, que troca o código de handoff pelo `app_token` no WordPress e guarda somente o hash do token em `fanframe_sessions`. A chave de armazenamento local é `vf_app_token:<slug>` para evitar troca de identidade entre times.

## Endpoints esperados na base WordPress do time

| Método e rota | Corpo/autorização | Resposta mínima |
| --- | --- | --- |
| `POST /handoff/exchange` | `{ "code": "..." }` | `{ "ok": true, "app_token": "...", "user_id": 123, "expires_at": "ISO 8601", "balance": 3 }` |
| `GET /credits/balance` | `X-Fanframe-Token` e `Authorization: Bearer <app_token>` | `{ "ok": true, "balance": 3 }` |
| `POST /credits/debit` | mesmos headers; `{ "generation_id": "UUID" }` | `{ "ok": true, "balance_after": 2 }` |

O WordPress deve validar expiração e escopo do token, responder 401/403 para sessão inválida e garantir **idempotência por `generation_id`**: repetir o débito com o mesmo UUID deve retornar sucesso sem reduzir o saldo outra vez. A operação de débito deve ser atômica no WordPress. Se a API responder `reason: "no_credits"`, o proxy devolve erro de crédito insuficiente. A integração usa HTTPS e timeout de 15 segundos.

Respostas privadas da API nunca devem entrar em cache compartilhado. Em 9/10/2026, o LiteSpeed de `spfc.virtualfans.com.br` respondeu `GET /credits/balance` com saldo antigo e `X-LiteSpeed-Cache: hit`, inclusive sem token. A mesma rota com query inédita respondeu 401 corretamente. O backend passa a usar uma query aleatória `_fanframe_nonce` em cada GET e headers `Cache-Control: no-cache, no-store`, sem incluir tokens na URL. Isso evita reutilizar o saldo antigo nas chamadas FanFrame, mas não remove entradas já armazenadas no WordPress.

O administrador WordPress deve desativar **LiteSpeed Cache > Cache > Cache REST API**, excluir a API `^/wp-json/vf-fanframe/v1/` das regras de cache de servidor/CDN e purgar as entradas antigas. Para controle específico do plugin, use `litespeed_control_set_nocache` e headers privados antes de emitir respostas REST. Confirme que `/credits/balance` sem token devolve 401 e nunca `hit`; depois valide saldo por usuário e débito único. Consulte a [documentação LiteSpeed](https://docs.litespeedtech.com/lscache/lscwp/api/). O deploy Supabase não altera essas configurações WordPress.

O crédito WordPress é verificado antes da reserva da geração e debitado pelo servidor quando o resultado está pronto, antes de liberar a URL assinada ao usuário. O estado `awaiting_payment` conserva o resultado até o débito ser confirmado. O histórico e o status filtram por time e dono. Se o usuário fechar a página antes do status final, o resultado pode ser recuperado pelo histórico após reconexão; uma rotina de reconciliação/expiração deve ser operada caso o volume torne jobs pendentes relevantes.

Links de teste usam `test_links` em vez do WordPress. A função autentica o token, reserva um crédito na transação de criação da geração e devolve o crédito se a geração falhar. Links expirados ou inativos são rejeitados.

`purchase_urls` aceita `credits1`, `credits3`, `credits7` como URLs HTTPS e, opcionalmente, `price1`, `price3`, `price7` como texto exibido. Se um time não tiver checkout configurado, a tela de compra mostra indisponibilidade; não redireciona para outro time. O painel de edição de time permite alterar esses campos.

Para testar sem dinheiro ou token externo, use um link de teste com crédito limitado. Para validar WordPress, use uma instalação de homologação e confira: código válido/expirado, saldo, débito repetido, falta de crédito, usuário com o mesmo ID numérico em dois times e retorno após recarregar a página.
