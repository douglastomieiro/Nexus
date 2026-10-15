# Nexus_ — documentação técnica

Para quem distribui, mantém ou quer entender o código. Para usar o app, veja o [README](../README.md).

## Login nas contas (como funciona)
O Mercado Livre exige a senha do aplicativo (`client_secret`) para trocar a autorização por tokens e para renová-los (o acesso vence a cada ~6 h). Essa senha não pode ir dentro do app — qualquer um a extrairia —, então fica num **intermediário** mínimo (`broker/worker.js`, Cloudflare Worker, código aberto):
- o app abre a página oficial do ML; depois do "Autorizar", o ML volta ao intermediário, que repassa o código ao app no **seu** computador;
- o app troca o código pelos tokens via intermediário, usando **PKCE** (o código não vale nada sem um segredo que só o app tem);
- as renovações também passam pelo intermediário. Ele **não tem banco nem log**: os tokens só ficam no seu PC.
- O app é o **único** que renova os tokens das contas conectadas (o refresh_token do ML é de uso único).

## Publicar o intermediário (quem distribui o app)
1. Crie um app no [DevCenter do Mercado Livre](https://developers.mercadolivre.com.br/devcenter) com **PKCE habilitado**, permissões de leitura/escrita e acesso offline. URI de redirecionamento: `https://<seu-worker>.workers.dev/ml/callback`.
2. Em `broker/wrangler.toml`, preencha `ML_CLIENT_ID`. Grave a senha como secret: `npx wrangler secret put ML_CLIENT_SECRET`.
3. Publique: `npx wrangler deploy` (dentro de `broker/`).
4. Copie `app-config.example.json` para `app-config.json` (fica fora do git), coloque o endereço do Worker e gere o instalador (`npm run dist`). Para testar sem recompilar: `NEXUS_BROKER=https://...` no `.env` da pasta de dados.

## Publicar uma versão (atualiza todo mundo)
O GitHub Actions (`.github/workflows/publicar.yml`) gera o instalador e cria a release quando recebe uma tag `v<versão>`.

**Uma vez só:** no GitHub, *Settings → Secrets and variables → Actions → Variables → New repository variable*: `BROKER_URL` = endereço do intermediário.

**A cada versão:**
1. `npm run versao -- patch` (correção: 0.2.0 → 0.2.1) ou `-- minor` (novidade: 0.2.0 → 0.3.0). Isso só muda o `package.json`.
2. `git commit -am "Versão 0.2.1"` e `git tag v0.2.1`.
3. `git push --follow-tags`.
4. Aguarde o Actions terminar (aba *Actions*, uns 5–10 min). Ele cria um **rascunho** em *Releases* com o `.exe` e o `latest.yml`.
5. Abra o rascunho, escreva o que mudou e clique em **Publish release**. A partir daí os apps instalados se atualizam sozinhos.

Para gerar só o instalador no seu PC, sem publicar: `npm run dist` (sai em `dist/<versão>/`).

## Modo avançado (.env)
Opcional, na pasta de dados (ou na pasta do projeto rodando com `node start.js`, que exige Node 22+):
- `TOKENS_LOJA<n>` / `NOME_LOJA<n>`: conta do ML lida de um arquivo de token mantido por **outro** programa (JSON com `access_token`, `expires_in` em segundos e `updated_at` em ms). O painel só lê e espera a renovação feita por fora.
- **Shopee** (por enquanto só aqui): `SHOPEE_TOKENS_LOJA<n>` (JSON com `access_token`, `expire_in`, `last_refresh_time`) + `SHOPEE_PARTNER_ID_LOJA<n>` / `SHOPEE_PARTNER_KEY_LOJA<n>`. A conta Shopee `shopee<n>` é tratada como a **mesma empresa** da conta ML `loja<n>` (mesma alíquota, mesmo filtro de loja).
- `NEXUS_BROKER`: outro intermediário (o seu, por exemplo).
- `HOST` (só com `node start.js`): padrão `127.0.0.1`. `0.0.0.0` abre para a rede local sem senha — **nunca** publique a porta na internet.
- Nunca versione, sincronize nem compartilhe o `.env`, a pasta `data/` ou arquivos de token.

## Coleta
Agendador interno: pedidos/atendimento a cada 5 min · anúncios a cada 1 h · Ads a cada 3 h · conta/promoções/categorias 03:30 · fatura do ML 04:30 · histórico de frete 05:00. Shopee: pedidos + escrow a cada 5 min, devoluções a cada hora.
Manual: `node server/collect.js [loja1 ...] [modulo ...] [--force] [--meses=12]` e `node server/shopee-collect.js [shopee1 ...] [pedidos|devolucoes] [--force] [--meses=12]`.
`SEM_COLETA=1` no ambiente sobe só o painel, sem agendador.

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
