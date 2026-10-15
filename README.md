# ML Dashboard — lucro real por pedido (Mercado Livre + Shopee)

Painel gratuito e de código aberto para vendedores do Mercado Livre e da Shopee. Calcula o **lucro real de cada pedido** (comissão, frete, imposto, custo do produto, Ads e devoluções) a partir das APIs oficiais.

- **Seus dados ficam no seu computador.** Pedidos, custos e tokens ficam num banco SQLite local; o app só conversa com as APIs do Mercado Livre e da Shopee.
- **Sem cadastro e sem mensalidade.** O único serviço do projeto na internet é o **intermediário de login** (veja abaixo), que não guarda nada. Licença MIT (veja `LICENSE`).

## Instalação (app para Windows)
1. Baixe e rode o instalador `ML Dashboard Setup <versão>.exe`. Sem assinatura digital, o Windows mostra "Windows protegeu o computador": clique em **Mais informações → Executar assim mesmo**.
2. Abra o **ML Dashboard**. Na primeira vez ele abre a tela **Contas**.
3. Clique em **Conectar conta do Mercado Livre**, entre na conta no navegador e clique em **Autorizar**. Volte ao app e clique em **Reiniciar agora**.
4. A primeira carga busca 12 meses de pedidos (algumas dezenas de minutos; o painel já funciona durante a carga).
5. Em **Configurações**, informe a alíquota do Simples de cada conta e, em **Custos**, o custo de cada SKU.

Os dados ficam em `%APPDATA%\ML Dashboard` (menu Arquivo → "Abrir pasta de dados").

**Segurança do app:** o servidor interno só escuta em `127.0.0.1`, numa porta sorteada a cada abertura, e exige uma chave criada a cada abertura que só a janela do app conhece (outros programas e sites recebem 403). Os tokens das contas ficam cifrados com o cofre do Windows.

## Login nas contas (como funciona)
O Mercado Livre exige a senha do aplicativo (`client_secret`) para trocar a autorização por tokens e para renová-los (o acesso vence a cada ~6 h). Essa senha não pode ir dentro do app — qualquer um a extrairia —, então fica num **intermediário** mínimo (`broker/worker.js`, Cloudflare Worker, código aberto):
- o app abre a página oficial do ML; depois do "Autorizar", o ML volta ao intermediário, que repassa o código ao app no **seu** computador;
- o app troca o código pelos tokens via intermediário, usando **PKCE** (o código não vale nada sem um segredo que só o app tem);
- as renovações também passam pelo intermediário. Ele **não tem banco nem log**: os tokens só ficam no seu PC.
- O app é o **único** que renova os tokens das contas conectadas (o refresh_token do ML é de uso único).

### Publicar o intermediário (quem distribui o app)
1. Crie um app no [DevCenter do Mercado Livre](https://developers.mercadolivre.com.br/devcenter) com **PKCE habilitado**, permissões de leitura/escrita e acesso offline. URI de redirecionamento: `https://<seu-worker>.workers.dev/ml/callback`.
2. Em `broker/wrangler.toml`, preencha `ML_CLIENT_ID`. Grave a senha como secret: `npx wrangler secret put ML_CLIENT_SECRET`.
3. Publique: `npx wrangler deploy` (dentro de `broker/`).
4. Copie `app-config.example.json` para `app-config.json` (fica fora do git), coloque o endereço do Worker e gere o instalador (`npm run dist`). Para testar sem recompilar: `ML_DASH_BROKER=https://...` no `.env` da pasta de dados.

## Modo avançado (.env)
Opcional, na pasta de dados (ou na pasta do projeto rodando com `node start.js`, que exige Node 22+):
- `TOKENS_LOJA<n>` / `NOME_LOJA<n>`: conta do ML lida de um arquivo de token mantido por **outro** programa (JSON com `access_token`, `expires_in` em segundos e `updated_at` em ms). O painel só lê e espera a renovação feita por fora.
- **Shopee** (por enquanto só aqui): `SHOPEE_TOKENS_LOJA<n>` (JSON com `access_token`, `expire_in`, `last_refresh_time`) + `SHOPEE_PARTNER_ID_LOJA<n>` / `SHOPEE_PARTNER_KEY_LOJA<n>`. A conta Shopee `shopee<n>` é tratada como a **mesma empresa** da conta ML `loja<n>` (mesma alíquota, mesmo filtro de loja).
- `ML_DASH_BROKER`: outro intermediário (o seu, por exemplo).
- `HOST` (só com `node start.js`): padrão `127.0.0.1`. `0.0.0.0` abre para a rede local sem senha — **nunca** publique a porta na internet.
- Nunca versione, sincronize nem compartilhe o `.env`, a pasta `data/` ou arquivos de token.

## Organização do menu
Cada item do menu é um grupo; as telas do grupo aparecem como abas no topo.
| Grupo | Abas |
|---|---|
| **Dashboard** | Dashboard (meta do mês, KPIs, recomendações, vendas diárias, por conta/logística/estado, top 10), Visão geral, Alertas, ML + Shopee |
| **Finanças** | DRE (meses em colunas + faturas do ML), Indicadores (rentabilidade, custos em % da receita, eficiência — 6 meses) |
| **Análise de Pedidos** | Análise de Pedidos (custos, repasse, resultado e margem por pedido; frete da NF e imposto sobre ele), Consulta (API), Devoluções, Envios, Atendimento |
| **Gestão de Produtos** | Tabela de Produtos (curva ABC + sinais), Análise por SKU (`#sku:CODIGO`), Custos, Cadastros (anúncios), Calculadora (preço/margem) |
| **Gestão Mercado Livre** | Dashboard de Ads, Campanhas, Anúncios Patrocinados (ACOS × margem), Anúncios Gerais, Promoções, **Descontos**, Full / Estoque, Reputação |
| **Gestão Shopee** | Dashboard, Pedidos, Produtos, Anúncios / Estoque, Ads, Promoções, Devoluções |
| **Configurações** | Configurações, Cobertura, Explorador de API |

- O filtro de **período** só aparece nas telas em que ele vale; nas outras aparece a janela usada (ex.: "últimos 90 dias" no Ads).
- O cabeçalho mostra **há quanto tempo os pedidos foram sincronizados** (verde ≤ 20 min, amarelo ≤ 2 h, vermelho acima: servidor parado ou token vencido).
- Meta de faturamento e preferências (métrica da curva ABC, valores da calculadora) ficam no navegador (localStorage).
- Clique no ID → abre a página no Mercado Livre; `{ }` → retorno bruto da API.

## Coleta
Agendador interno: pedidos/atendimento a cada 5 min · anúncios a cada 1 h · Ads a cada 3 h · conta/promoções/categorias 03:30 · fatura do ML 04:30 · histórico de frete 05:00. Shopee: pedidos + escrow a cada 5 min, devoluções a cada hora.
Manual: `node server/collect.js [loja1 ...] [modulo ...] [--force] [--meses=12]` e `node server/shopee-collect.js [shopee1 ...] [pedidos|devolucoes] [--force] [--meses=12]`.
`SEM_COLETA=1` no ambiente sobe só o painel, sem agendador.

## Como o lucro é calculado (Mercado Livre, por item de cada pedido)
`lucro = receita − devolução − comissão ML − frete do vendedor − imposto − custo do produto − Ads`
- **Comissão**: `sale_fee` do pedido (confere centavo a centavo com o billing do ML, inclusive em pedidos antigos).
- **Frete**: custo do vendedor em `shipments/{id}/costs`, coletado para os 12 meses. O comprador repassa a parte dele; o ML cobra o frete total na fatura, mas o custo líquido é o do vendedor.
- **Imposto (Simples)**: alíquota do mês × (receita + frete cobrado do comprador na NF-e). Informe a alíquota em **Configurações** (modo manual). O frete do comprador não é receita nem custo, mas entra na base do imposto.
- **Custo do produto**: digitado por SKU. **Ads**: custo por anúncio/dia (API, 90 dias) rateado entre os pedidos do dia; gasto sem venda aparece à parte.
- **Devoluções**: pedidos cancelados com reembolso saem da receita; perda = frete de ida + tarifa de devolução + comissão não estornados (extrato do pedido na fatura) + retenção `fee_spl` e taxa de parcelamento não estornadas (pagamento do MP) (+ custo do produto, se marcado e o produto chegou a sair). Venda mantida por cobertura do ML (`bpp_covered`): entra o líquido recebido − imposto − custo (pode ser negativo).
- **Reembolso parcial** (pedido continua válido): receita, comissão e frete na NF caem na proporção do reembolso; o custo do produto só é abatido quando o reembolso corresponde a unidades inteiras devolvidas.
- **DRE / fatura do ML**: "outras cobranças" = Full (armazenagem, coleta, inconformidade), eShop, DIFAL e não identificadas. NÃO entram: parcelamento (CFONPN — acréscimo pago pelo comprador, soma zero) e tarifas de devolução (já contadas por pedido). A fatura é por período de cobrança (≈ 16→15), não por mês-calendário.
- **Precisão depende dos custos**: SKU sem custo conta como R$ 0. Preencha em **Custos** (dá para colar `SKU;custo` em lote de uma planilha).
- **Dia comercial** = fuso de Brasília (o ML devolve datas em -04:00).

## Shopee (só leitura)
- **Lucro:** a Shopee entrega o repasse real de cada pedido (`payment/get_escrow_detail_batch`, campo `escrow_amount`). `lucro = escrow − imposto − custo`. Colunas: faturamento, comissão/taxas, frete líquido, devolução e **ajustes** (vouchers do vendedor, compensações, retenções), de modo que tudo fecha com o escrow. Pedido sem escrow é estimado pela taxa média da loja e marcado.
- **Imposto:** mesma alíquota da conta ML de mesmo número, sobre faturamento − devolução + frete pago pelo comprador.
- **Custos:** a mesma tabela do ML (por SKU). O SKU da Shopee é o da variação (`model_sku`); se não houver, o do anúncio.
- **Ads:** a API só entrega o gasto da loja inteira por dia; o gasto é rateado entre os pedidos do dia pelo faturamento.
- **Ainda não tem:** campanhas relâmpago, aplicar descontos/cupons pela API, "por estado" (dado do comprador vem mascarado) e DRE com fatura (o consolidado ML + Shopee cobre o resultado mensal).

## Descontos (única tela que ESCREVE no Mercado Livre)
Em Gestão Mercado Livre → **Descontos**: lista os anúncios ao vivo; define preço ou % de desconto por anúncio, nos selecionados ou em massa; **aplica** (PRICE_DISCOUNT, 1–30 dias) e **desativa** a promoção no ML; lote com barra de progresso, repetição automática das falhas e botão cancelar; categorias próprias por loja; **Promoções ML** (DEAL, relâmpago, SMART, volume…); cada preço mostra a margem (comissão, frete, imposto e custo).
Usa os mesmos tokens das contas conectadas na tela **Contas** (o app do intermediário precisa ter permissão de escrita).

## Backup dos custos
Os custos digitados à mão não podem ser recoletados da API, então são salvos a cada alteração em `backup-custos/` (fora de `data/`):
- `custos-atual.json` e `custos-atual.csv` — último estado; `historico/` — um instantâneo por hora com alteração (últimos 200).
- Se a tabela de custos estiver vazia ao iniciar e houver backup, ele é **restaurado sozinho**. Um backup com custos nunca é trocado por um vazio.
- Manual: `node scripts/backup-custos.mjs` (faz backup) · `node scripts/backup-custos.mjs --restaurar [arquivo.json] [--forcar]`.

## Estrutura
- `server/` — `index.js` (API e site), `collectors.js` (coleta ML), `margem.js` (motor de lucro, DRE, imposto), `analises.js` (alertas e margem das promoções), `painel.js` (telas do Dashboard), `sync.js` (agendador), `ml.js` (cliente ML + contas), `db.js` (SQLite), `shopee*.js` (cliente, coleta, motor e rotas da Shopee), `descontos/` (tela Descontos).
- `web/` — `index.html` (base, menu, telas originais), `extra.js`, `jodda.js|css`, `shopee.js`, `descontos.js|css`.
- `scripts/` — ferramentas de diagnóstico (`00-check.mjs` confere os tokens; `02-probe.mjs` e `03-report.mjs` testam a cobertura da API; `08-shopee-probe.mjs` sonda a Shopee).
- `data/ml.db` — resposta crua de cada endpoint (recurso, chave). Falha nunca sobrescreve dado bom.

## Licença
MIT — veja `LICENSE`.
