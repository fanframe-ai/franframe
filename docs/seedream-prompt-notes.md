# Seedream 5 Pro: fidelidade do provador

Pesquisa em 2026-10-09. Escopo: imagem 1 = foto enviada; imagem 2 = camisa selecionada; imagem 3 = cenario selecionado. Nenhuma geracao paga foi realizada nesta pesquisa.

## Contrato do modelo usado

O [README oficial no Replicate](https://replicate.com/bytedance/seedream-5-pro/readme) descreve referencia de personagens/produtos e composicao com ate dez imagens. Em `match_input_image`, a proporcao segue a primeira referencia; isso nao implica conservar seus pixels ou seu tamanho original. O modo padrao oferece 1K e 2K, com PNG ou JPEG.

O [schema do Replicate](https://replicate.com/bytedance/seedream-5-pro/api/schema), inclusive seu JSON embarcado, limita `prompt` a 4000 caracteres e descreve 1-10 referencias em `image_input`. Nao apresenta parametros `seed`, `negative_prompt`, `strength`, CFG ou pesos por referencia. Nao inventar esses controles; restricoes devem estar no prompt. O modo de decomposicao em camadas tem outro contrato e nao e o provador de tres referencias.

## Orientacoes oficiais de prompt

O [guia Volcengine 4.0-5.0](https://docs.volcengine.com/docs/ark/seedream-4-0-5-0-prompt-guide?lang=zh) recomenda linguagem natural concisa, identificar a operacao e o objeto editado, explicitar o que permanece igual e atribuir separadamente a funcao de cada imagem. Para varias referencias, seus exemplos identificam imagens por indice. Recomenda referencias nitidas para conservar detalhes de produtos, em vez de palavras genericas de qualidade.

Ressalva: o texto desse guia nomeia 5.0 Lite, 4.5 e 4.0, nao constitui um guia exclusivo de 5 Pro. Aplicar suas orientacoes gerais como heuristicas. A [API atual Volcengine](https://docs.volcengine.com/docs/ark/image-generation-api?lang=zh&redirect=1), que inclui Pro, recomenda ate 600 palavras em ingles: textos excessivos podem dispersar a atencao. Limites e parametros do nosso endpoint continuam sendo os do Replicate.

O [anuncio oficial ByteDance Seed 5.0 Pro](https://seed.bytedance.com/en/blog/beyond-generation-it-understands-design-introducing-seedream-5-0-pro) demonstra composicao e edicao com referencias numeradas, preservacao espacial e materiais realistas. Tambem reconhece limites na consistencia de edicao em nivel de pixel e na renderizacao de texto fino. Nao prometer reproducao perfeita de rosto, patrocinadores ou letras apenas por reforcar o prompt.

## Aplicacao ao FanFrame

Estas sao decisoes de engenharia inferidas das fontes, nao garantias do fornecedor:

- Comecar pela tarefa: editar a foto, vestindo as pessoas com a camisa escolhida e usando o cenario escolhido; nao recriar uma campanha ou uma pessoa idealizada.
- Declarar os tres indices na ordem real de `image_input`. Imagem 1 governa identidade, quantidade de pessoas, expressoes, poses, proporcoes e enquadramento; nao copiar pessoas ou manequins das outras referencias.
- Imagem 2 governa somente a camisa: corte, gola, mangas, cores, listras, escudo, patrocinadores e letras visiveis, com posicoes relativas preservadas. Adaptar tecido a postura e oclusoes naturais; nao preencher detalhes ocultos com marcas inventadas.
- Imagem 3 governa o novo fundo: conservar estruturas, objetos, perspectiva e sinalizacao visivel; evitar reimaginar o estadio, inserir publico ou redesenhar logos. Se a proporcao exigir adaptacao, usar recorte minimo sem distorcer, sem prometer pixels inalterados.
- Limitar ajustes de luz a integracao natural das pessoas e camisa. Manter textura de pele; evitar embelezamento, mudancas anatomicas e estetica cinematografica extra.
- Remover "8K quality" e superlativos repetidos: a API continua em 2K. Priorizar identidade, camisa e cenario com instrucoes claras, sem contradicoes.

Validacao visual ainda exige geracoes reais comparativas autorizadas: comparar identidade, camisa/logos, cenario e anatomia, incluindo grupos, oclusoes e selfies. Testes de codigo validam o contrato do prompt, nao a fidelidade das imagens.
