# Monitoramento de concorrência Moderna Mobília

[Abrir painel](https://modernaamobilia.github.io/monitoramento-concorrencia-moderna/)

## Coleta

GitHub Actions executa diariamente às 10h17 UTC, correspondentes a 7h17 em Brasília. O agendamento do GitHub pode sofrer atrasos. Também permite execução manual em Actions → Coleta diária de preços e fretes → Run workflow. Repositórios públicos sem atividade por 60 dias podem ter agendamentos desativados pelo GitHub.

São 23 anúncios fixos, com uma unidade por cotação, oito CEPs e preço à vista sem cupom. A seleção de concorrentes e as ressalvas técnicas continuam manuais; não há substituição automática de produtos. IDs de variantes ficam fixados em `variantes_aprovadas.json`. Troca de variante ou vendedor provoca falha e requer revisão.

Moderna usa a calculadora pública do Portal do Seller. Easy House e Bom Pastor usam simulação pública VTEX. Madesa usa a calculadora pública Checkstore. MadeiraMadeira usa o cálculo público do anúncio, mantendo o vendedor selecionado e excluindo a própria Moderna. Magalu usa navegador Chromium comum e o formulário público do anúncio, mantendo a Easy House como vendedora. Não utiliza mecanismos de disfarce ou contorno de bloqueios. Se a loja bloquear o navegador do runner, a rodada registra falha. CEP rejeitado e ausência expressa de entrega são registrados com a mensagem da loja; não são frete grátis nem erro técnico.

## Histórico e falhas

`historico_cotacoes.json` mantém uma observação diária por anúncio, URL e CEP. Reexecuções no mesmo dia revisam essa observação, mas todas as tentativas permanecem nos arquivos imutáveis de `coletas/`, com horário UTC. `historico_inicial.json` preserva a base anterior à automação. `ultima_coleta.json` registra 184 situações, inclusive falhas. Indisponibilidade confirmada é diferente de erro técnico; frete ausente nunca é zero.

O painel só inclui na disputa as cotações completas da rodada publicada. A última cotação válida permanece no histórico. Uma alteração de preço sem frete correspondente não forma um novo total válido. A condição de menor custo entregue não confirma posição de buybox em um marketplace.

## Excel e publicação

O runner usa openpyxl porque o runtime de autoria artifact-tool não está disponível no GitHub. Mantém o Excel existente, atualiza entradas e acrescenta Histórico e Situação da coleta. LibreOffice recalcula as fórmulas e a verificação bloqueia a publicação se encontrar erros. O HTML é gerado a partir da mesma base. A publicação ocorre somente após essas etapas. Uma falha de geração mantém o painel anterior.

O workflow exige GitHub Actions autorizado a gravar no repositório e Pages configurado para GitHub Actions. Não usa senha ou chave das lojas. Tudo no repositório é público. Falhas aparecem na aba Actions e nas notificações nativas do GitHub. Não são necessários serviços pagos para esta implementação.

## Testes

`node --test tests/*.test.mjs` verifica oito CEPs, valores zero, ausência de frete/prazo, interpretação de preço promocional, 40 telas e referência sem cotação. O teste real completo fica registrado em `coletas/`. O resultado da execução cloud valida as integrações a partir do IP do runner; pode diferir da consulta local.
