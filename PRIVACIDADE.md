# Privacidade e segurança do NEXUS_

Resumo: **seus pedidos, custos e margens ficam só no seu computador.** Não temos servidor com os seus dados, não pedimos cadastro e não vendemos, compartilhamos ou analisamos informação nenhuma sobre você ou sua loja.

Este documento diz exatamente o que o app faz. O código é aberto: você ou alguém de confiança pode conferir cada afirmação aqui.

## O que fica no seu computador
Tudo isto fica em `%APPDATA%\NEXUS_` e **nunca** é enviado para nós:
- pedidos, anúncios, devoluções, Ads, faturas e demais dados baixados da sua loja;
- os custos dos produtos, as alíquotas de imposto e as margens calculadas;
- as autorizações (tokens) das suas contas, **cifradas** com o cofre do Windows;
- as cópias de segurança dos custos (pasta `backup-custos`).

Suas preferências de tela (como a meta do mês) ficam no próprio app.

## Com quem o app se comunica
O app só abre conexão com estes destinos:

| Destino | Para quê | O que é enviado |
|---|---|---|
| **Mercado Livre** (`api.mercadolibre.com`) e **Mercado Pago** (`api.mercadopago.com`) | Baixar os dados da sua loja e, na tela Descontos, aplicar ou desativar promoções quando você mandar | As requisições normais da API, usando a autorização que você deu |
| **Intermediário de login** (Cloudflare Worker, código em `broker/`) | Conectar e renovar o acesso da sua conta | Veja a seção abaixo |
| **GitHub** (`github.com`, Releases) | Procurar e baixar novas versões do app | Uma consulta de versão. O GitHub pode registrar o seu IP, como em qualquer site |

Não há anúncios, analytics, telemetria, relatórios de erro automáticos nem qualquer serviço de terceiros além dos acima. A tela do app usa a fonte do sistema e não carrega nada de Google, CDNs ou similares.

## O intermediário de login
O Mercado Livre exige uma "senha do aplicativo" (`client_secret`) para liberar e renovar o acesso. Ela não pode ficar dentro do programa, porque qualquer pessoa conseguiria extraí-la, então fica nesse pequeno intermediário.

- No login e a cada renovação (cerca de a cada 6 horas), o app envia ao intermediário o código de autorização ou o token de renovação. O intermediário repassa ao Mercado Livre junto com a senha do aplicativo e devolve os tokens ao app. **Os tokens passam por ele, mas não ficam guardados.**
- O intermediário **não tem banco de dados e não grava registros** do que recebe. O código dele é público e tem cerca de 70 linhas.
- **Seus pedidos, custos, margens e dados de clientes nunca passam por ele.**
- Como é um serviço hospedado na Cloudflare, a própria Cloudflare pode registrar dados técnicos de conexão (como o IP) da forma que faz com qualquer site.
- Você pode apontar o app para o seu próprio intermediário (veja `docs/DESENVOLVIMENTO.md`).

Limite honesto: quem controla o intermediário poderia, em tese, alterar o código para registrar tokens. É por isso que ele é pequeno, aberto e não tem armazenamento, e é por isso que o acesso concedido só permite o que você autorizou no Mercado Livre e pode ser revogado por você a qualquer momento.

## Como o app se protege no seu computador
- O servidor interno do painel só escuta em `127.0.0.1` (o próprio computador), numa porta sorteada a cada abertura.
- Ele exige uma chave criada a cada abertura, que só a janela do app conhece. Outros programas e sites recebem erro 403.
- Os tokens são cifrados com o cofre do Windows (DPAPI).
- As atualizações têm a integridade conferida (sha512) antes de instalar.

Limite honesto: quem tem acesso à sua conta de usuário do Windows (por exemplo, um vírus rodando como você) pode ter acesso aos mesmos arquivos que você. Mantenha o Windows e o antivírus atualizados.

## Seus controles
- **Desconectar uma loja:** tela **Contas → Desconectar**. O acesso é apagado do computador. Para revogar também no Mercado Livre, remova o aplicativo em *Minha conta → Segurança → Aplicativos conectados*.
- **Apagar tudo:** desinstale o app e apague a pasta `%APPDATA%\NEXUS_` (e `backup-custos`, se existir).
- **Exportar seus custos:** estão em `backup-custos` em JSON e CSV.

## Dados pessoais e LGPD
Como não recebemos nenhum dado seu ou dos seus clientes, não somos controladores nem operadores desses dados. Os dados dos compradores que o Mercado Livre entrega ao app (por exemplo, nome e cidade em um pedido) ficam apenas no seu computador, e você é quem responde por eles perante a LGPD. Recomendamos não copiar nem compartilhar a pasta de dados.

## Pedidos de ajuda e dúvidas
Abra uma [issue](https://github.com/douglastomieiro/ydata/issues). **Nunca** cole tokens, senhas ou dados da sua loja ao relatar um problema.

Se encontrar uma falha de segurança, avise em particular pelo recurso de aviso de vulnerabilidade do GitHub (aba *Security* do repositório) antes de divulgar.

_Última atualização: 15/10/2026._
