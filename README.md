<p align="center"><img src="web/logo.svg" alt="Logo do Nexus" width="130"></p>

# Nexus — o lucro real de cada pedido e a sua loja num lugar só

Painel gratuito para vendedores do **Mercado Livre**. Mostra quanto você realmente ganhou em cada venda, já descontando comissão, frete, imposto, custo do produto, Ads e devoluções. E traz a área de vendedor do Mercado Livre para dentro do app: responder perguntas e mensagens, cuidar de reclamações, imprimir etiquetas, mudar preço e estoque, gerenciar o Ads, tudo com o lucro de cada coisa ao lado, sem precisar abrir o site do Mercado Livre.

## Seus dados são seus. Ponto.

Muitas plataformas que se conectam à sua loja guardam seus pedidos, custos e margens em servidores deles. Esses dados mostram quanto você paga pelos produtos, qual é sua margem e o que vende mais, e é exatamente o que um concorrente gostaria de ter. O Nexus foi feito para que isso **não aconteça**:

| | |
|---|---|
| 🖥️ **Tudo fica no seu computador** | Pedidos, custos, margens e relatórios ficam num banco de dados dentro do seu PC. Não existe servidor nosso guardando suas informações. |
| 🔒 **Seu custo e sua margem nunca saem daí** | O custo que você digita por produto só existe na sua máquina. Ninguém consegue ver, copiar ou vender. |
| 🚫 **Sem cadastro, sem conta, sem mensalidade** | Você não cria login conosco e não nos informa e-mail, CPF ou CNPJ. |
| 👁️ **Sem rastreamento** | Não há anúncios, analytics nem telemetria. O app só conversa com o Mercado Livre (e o Mercado Pago, para dados de pagamento dos seus pedidos), com o intermediário de login e com o GitHub (para buscar atualizações). Veja a lista completa em [PRIVACIDADE.md](PRIVACIDADE.md). |
| 🔑 **Acesso protegido** | As autorizações das suas lojas são guardadas **cifradas** pelo cofre do próprio Windows. O painel interno só responde ao próprio app, e outros programas e sites do seu computador são bloqueados. Se mais gente usa o computador, dá para ligar **perfis com senha** (dono, atendimento, expedição…), cada um só com as telas e ações que você liberar. |
| 📖 **Código aberto** | Qualquer pessoa pode ler o código e conferir que é assim (licença MIT). Você não precisa confiar na nossa palavra. |
| ✋ **Nada muda sem você mandar** | O app só altera algo na sua loja quando você clica e confirma na tela: responder uma pergunta, mudar um preço, imprimir uma etiqueta, pausar um anúncio. Cada alteração fica registrada em **Configurações › Histórico de ações**, com o que foi pedido e o que o Mercado Livre respondeu. |

### O único ponto na internet: o login
Para o Mercado Livre liberar o acesso à sua loja, é preciso uma "senha do aplicativo" que não pode ficar dentro do programa. Ela fica num pequeno **intermediário de login** (código aberto, em `broker/`), que apenas repassa o pedido de autorização ao Mercado Livre. Ele **não tem banco de dados nem registro de nada**: seus pedidos, custos e margens jamais passam por ele. As autorizações ficam só no seu computador.

### Você está no controle
- Para desconectar uma loja, clique em **Desconectar** na tela **Contas** (o acesso é apagado do computador) e, se quiser, revogue o acesso na sua conta do Mercado Livre.
- Para apagar tudo, desinstale o app e apague a pasta `%APPDATA%\Nexus`.
- Seus custos têm cópia de segurança automática, também no seu computador.

## O que você ganha

### A central do vendedor, com o lucro ao lado
- **Resumo**: a tela inicial com o que está pendente (perguntas, mensagens, reclamações, etiquetas, NF-e, anúncios sem estoque, Ads com prejuízo), a semana contra a anterior, a reputação de cada conta com o que pesou nela, o desempenho dos envios e a fatura do Mercado Livre.
- **Atendimento**: perguntas (com a margem do anúncio e as perguntas anteriores do comprador), mensagens pós-venda com a ficha da venda ao lado, reclamações e devoluções com a perda real de cada uma, revisão do produto devolvido e respostas prontas.
- **Vendas**: a lista de despacho como a do Mercado Livre (hoje, próximos dias, Full, em trânsito, finalizadas), com etiquetas em PDF ou térmica (ZPL), nota interna, anexar NF-e e iniciar conversa com o comprador.
- **Ao vivo**: as vendas de hoje chegando, com faturamento, resultado e **margem média do dia** comparados com ontem até a mesma hora.
- **Gestão de anúncios**: preço (com o preço mínimo pela sua margem), estoque (inclusive por variação e por depósito), título, descrição, fotos, ficha técnica, tipo de anúncio, pausar e reativar; um por vez ou em lote, por planilha.
- **Gerenciar Ads**: campanhas e anúncios patrocinados com o lucro **depois** do Ads; orçamento, ROAS alvo, estratégia, pausar, incluir e tirar anúncios.

### Lucro e análise
- **Lucro real por pedido**, com comissão, frete, imposto (Simples), custo do produto, Ads e devoluções.
- **Dashboard** com meta do mês, vendas por dia, por conta, por estado, top produtos e recomendações.
- **DRE mensal** com custos fixos, fechamento do mês e indicadores de rentabilidade.
- **Curva ABC e análise por produto (SKU)**, com sinais do que vale a pena manter, reajustar ou parar.
- **Nexus Metrics**: buscas, mais vendidos, concorrência e projeções do seu mercado.
- **Calculadora de preço e margem.**
- **Promoções e descontos** (inclusive em massa), mostrando a margem de cada preço antes de aplicar.
- **Devoluções, envios, reputação e Full/estoque**, com **alertas** e um sino para o que precisa de resposta.
- **Várias contas/lojas** do Mercado Livre no mesmo painel.

### Do seu jeito (Configurações › Personalizar)
- **Módulos**: desligue o que você não usa; some do menu, do Resumo e da coleta.
- **Minhas regras**: margem mínima, cobertura de estoque, ACOS máximo, qualidade do anúncio e prazo de resposta valem para todas as telas.
- **Menu, Resumo, colunas e filtros**: favoritos no topo, abas escondidas, colunas que você escolhe e filtros salvos.
- **Perfis com senha** para quem divide o computador.

## Usar no navegador (sem instalar)

Também dá para usar o Nexus direto no site, sem baixar nada: o painel roda inteiro no seu navegador e guarda os dados nele (veja os limites em [PRIVACIDADE.md](PRIVACIDADE.md#versão-web-site-no-github-pages)).

- **Aviso:** na versão web as chamadas ao Mercado Livre passam pelo intermediário de login (que só repassa e não guarda nada). No app para Windows, só o login passa por ele.
- A coleta só roda com a aba aberta (a primeira carga de 12 meses pode levar um tempo), só uma aba por vez, e os **custos ficam só no seu navegador**: use *Configurações → Baixar backup* de vez em quando.
- No site não há **perfis com senha**, e o que envolve arquivo (baixar etiquetas, anexar NF-e, enviar fotos e anexos) só funciona no app para Windows.
- Para publicar o seu próprio site (GitHub Pages), veja [docs/DESENVOLVIMENTO.md](docs/DESENVOLVIMENTO.md#site-web-github-pages).

## Como instalar (Windows)

1. Baixe o instalador `Nexus Setup <versão>.exe` na página de [Releases](https://github.com/douglastomieiro/Nexus/releases/latest) e rode.
   > Como o instalador ainda não tem assinatura digital paga, o Windows pode mostrar "O Windows protegeu o computador". Clique em **Mais informações → Executar assim mesmo**.
2. Abra o **Nexus**. Na primeira vez ele abre a tela **Contas**.
3. Clique em **Copiar link de autorização**, cole no navegador em que sua conta do Mercado Livre está logada e clique em **Autorizar**. Com mais de uma loja, repita no navegador (ou perfil) de cada conta. Depois volte ao app e clique em **Reiniciar agora**.
4. Aguarde a primeira carga, que busca 12 meses de pedidos (pode levar algumas dezenas de minutos). O painel já funciona enquanto carrega.
5. Em **Configurações**, informe a alíquota do Simples de cada conta e, em **Custos**, o custo de cada produto.

> **Dica:** o lucro só é tão preciso quanto os custos que você informa. Produto sem custo conta como R$ 0. Em **Custos** dá para colar `SKU;custo` em lote, direto de uma planilha.

**Atualizações automáticas:** o app procura versão nova ao abrir e a cada 6 horas, confere a integridade do arquivo e pergunta se você quer reiniciar. Suas contas e dados continuam intactos.

## Como o lucro é calculado

`lucro = receita − devolução − comissão − frete do vendedor − imposto − custo do produto − Ads`

- **Comissão e frete** vêm direto do Mercado Livre, pedido a pedido (a comissão confere com a fatura).
- **Imposto**: a alíquota do Simples que você informa, aplicada sobre a receita e o frete cobrado do comprador na nota.
- **Ads**: o gasto de cada anúncio no dia é dividido entre os pedidos daquele dia.
- **Devoluções**: saem da receita, e entram como perda o frete, as tarifas e a comissão que não foram estornados.
- O dia comercial segue o horário de Brasília.

## Dúvidas, problemas ou sugestões

Abra uma [issue](https://github.com/douglastomieiro/Nexus/issues). Não coloque tokens, senhas nem dados da sua loja ao relatar um problema.

---

Documentação técnica (publicar versões, intermediário de login, modo avançado, testes, estrutura do código): [docs/DESENVOLVIMENTO.md](docs/DESENVOLVIMENTO.md).

[Política de privacidade completa](PRIVACIDADE.md) · Licença MIT — veja [LICENSE](LICENSE).
