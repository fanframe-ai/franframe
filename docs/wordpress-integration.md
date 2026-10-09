# Contrato WordPress ↔ FanFrame

Cada time tem `wordpress_api_base` e `purchase_urls` em `teams`. O backend lê a URL daquele time; nenhuma rota usa um site padrão de outro clube. O navegador envia `team_slug` para `fanframe-proxy`, que troca o código de handoff pelo `app_token` no WordPress e guarda somente o hash do token em `fanframe_sessions`. A chave de armazenamento local é `vf_app_token:<slug>` para evitar troca de identidade entre times.

## Mais de um WordPress no mesmo provador

`wordpress_sites` adiciona até três bases HTTPS e seus próprios `purchase_urls`, sem substituir a base principal. O exchange recebe `wordpress_origin` como pista e valida a origem contra essa lista no servidor; não tenta trocar o código em vários sites. A sessão fica vinculada atomicamente à base validada. Saldo, débito idempotente e checkout usam essa mesma base. IDs de usuário iguais em sites diferentes têm donos diferentes; os usuários antigos da base principal mantêm seu histórico. Alterar a pista no cliente não muda a base de uma sessão existente.

A base principal não pode ser redirecionada para outro site depois de existirem sessões ou gerações WordPress: o banco rejeita a mudança para preservar a identidade histórica `wp:<id>`. Adicione a nova origem a `wordpress_sites`; uma troca definitiva de identidade requer migração de dados explícita ou outro provador, não somente editar a URL.

Configure o destino do plugin com a origem explícita, para funcionar também quando o navegador não fornece `Referer`:

- Produção: `https://franframe.vercel.app/saopaulo-sp7k2x?wordpress_origin=https%3A%2F%2Ftricolorvirtualexperience.net`
- Homologação: `https://franframe.vercel.app/saopaulo-sp7k2x?wordpress_origin=https%3A%2F%2Fspfc.virtualfans.com.br`

O plugin acrescenta `code` mantendo o parâmetro de origem. O frontend também aceita a origem HTTPS do site que embute o iframe, quando existe. Links antigos sem indicação continuam usando a base principal; não reutilize um código de homologação em produção. Se um código já consumido falhar, a sessão salva só é recuperada quando pertence à mesma origem solicitada. Uma troca de origem limpa apenas a referência de recuperação local; o histórico continua privado no servidor.

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

`purchase_urls` aceita `credits1`, `credits3`, `credits7` como URLs HTTPS e, opcionalmente, `price1`, `price3`, `price7` como texto exibido. Se um time não tiver checkout configurado, a tela de compra mostra indisponibilidade; não redireciona para outro time. Na aba Integração do painel, cada WordPress tem seus próprios checkouts e preços logo abaixo da URL. “Adicionar WordPress” cria outro conjunto independente, até três adicionais. O painel aceita a raiz HTTPS do site (completa a base `/wp-json/vf-fanframe/v1` ao salvar) ou a base da API. Rejeita origens repetidas, credenciais na URL e checkouts de outro domínio. Alterar ou remover a base de um WordPress adicional invalida suas sessões existentes; editar apenas os checkouts não muda a identidade dos usuários.

Para testar sem dinheiro ou token externo, use um link de teste com crédito limitado. Para validar WordPress, use uma instalação de homologação e confira: código válido/expirado, saldo, débito repetido, falta de crédito, usuário com o mesmo ID numérico em dois times e retorno após recarregar a página.
