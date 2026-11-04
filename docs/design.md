# Vecka — design (Rádio III)

Decisões visuais aprovadas pelo Leonardo em 04/11/2026. Não mudar sem perguntar. Substitui o
visual "Papel" da fase 2. A referência visual exata são os mockups em `docs/design/mockups/`
(abra o HTML e leia os estilos inline: são a fonte da verdade de medidas e sombras). O
comportamento (o que cada tela faz) continua o mesmo das fases 2 e 3, exceto onde está escrito
"muda" abaixo.

## Conceito

Um aparelho de rádio Braun para a semana. Papel granulado como fundo, uma **placa marfim** e um
**painel grafite** em leve relevo, teclas físicas, um **dial de sintonia** para os dias e a data
em **placas de virar** (split-flap). Uma única cor de destaque, o **verde ácido**.

## Cores

Tokens (claro / escuro). Nenhuma outra cor fora daqui. O vermelho `#CF1020` sai do app.

| Token          | Claro              | Escuro          | Uso                                                          |
| -------------- | ------------------ | --------------- | ------------------------------------------------------------ |
| `paper`        | `#E7E4DC`          | `#1A1A19`       | fundo, com grão (ver Textura)                                |
| `plate`        | `#F3F1EB`          | `#262624`       | placa: card do dia, card do calendário, folhas, ajustes      |
| `panel`        | `#232321`          | `#0F0F0E`       | painel: dial, barra inferior, placas de virar, tecla de hoje |
| `key-dark`     | `#3A3A37`          | `#2B2B28`       | tecla escura sobre painel                                    |
| `knob`         | `#2B2B28`          | `#2B2B28`       | botão giratório de ajustes                                   |
| `sunken`       | `#E9E6DE`          | `#1E1E1C`       | campo afundado sobre placa                                   |
| `sunken-dark`  | `#2B2B28`          | `#1E1E1C`       | campo afundado sobre painel                                  |
| `flap-top`     | `#2B2B28`          | `#161615`       | metade de cima da placa de virar                             |
| `flap-gap`     | `#0E0E0D`          | `#000000`       | linha do meio da placa; sombra da metade que gira            |
| `ink`          | `#1E1E1E`          | `#EDEAE1`       | texto principal, bordas da caixa de tarefa                   |
| `muted`        | `#4F4E4B`          | `#A9A8A4`       | texto secundário: rótulos, tarefa feita, numeração, dicas    |
| `off`          | `#8E8D89`          | `#7A7975`       | desligado: teclas inativas, dias sem acesso, ponto histórico |
| `ink-on-panel` | `#EDEAE1`          | `#EDEAE1`       | texto principal sobre painel                                 |
| `muted-panel`  | `#A9A8A4`          | `#A9A8A4`       | texto secundário sobre painel                                |
| `off-panel`    | `#626160`          | `#5A5955`       | desligado sobre painel                                       |
| `rule`         | `#C4C1B9`          | `#3E3E3B`       | tracejado entre tarefas, pontos do tamanho, alça da folha    |
| `tick-major`   | `#EDEAE1`          | `#EDEAE1`       | marcações principais do dial                                 |
| `tick-minor`   | `#55554F`          | `#4A4A46`       | marcações menores do dial e linha base (0,75 px)             |
| `accent`       | `#C4F000`          | `#C4F000`       | verde ácido: ponteiro, tecla principal, feita, atrasado, LED |
| `on-accent`    | `#1E1E1E`          | `#1E1E1E`       | texto e ícones sobre o verde                                 |
| `scrim`        | `rgb(35 35 33/.4)` | `rgb(0 0 0/.5)` | fundo escurecido atrás da folha                              |

**Texto: três tons por superfície** (principal, secundário, desligado): `ink` / `muted` / `off`
sobre placa e papel, `ink-on-panel` / `muted-panel` / `off-panel` sobre painel (no escuro, os de
placa e painel coincidem nos dois primeiros). Nenhuma opacidade solta em cor de texto ou fundo:
estado desligado ou pressionado muda para o tom `off`, nunca `opacity`.

Regras do verde:

- **O verde só aparece como preenchimento** (tecla, etiqueta, caixa feita, ponteiro, LED) ou
  como **texto sobre painel escuro** (dia selecionado no dial, número de hoje no calendário).
  Nunca como texto ou ponto pequeno sobre placa/papel claros: o contraste é baixo demais.
- **Uma tecla verde por tela**: a ação principal (adicionar, próximo mês, salvar).
- Sobre o verde, sempre `on-accent` (contraste ≥ 12:1).
- Erros: etiqueta `panel` com texto `ink-on-panel` e um ponto verde à esquerda (o LED).

## Textura

Grão de papel em toda a tela: `feTurbulence` (fractalNoise, baseFrequency 0.9, 3 oitavas) num
**ladrilho de 200 px** (`public/grain-day.svg`, `public/grain-night.svg`, com a opacidade já no
alfa) repetido no `body::before`, `mix-blend-mode: multiply` no claro e `screen` no escuro. Sem
`pointer-events`. Muda (fase 4): antes era um SVG da tela inteira por tema, e trocar de tema
recalculava o ruído da tela toda num quadro só (era o travamento do seletor de tema).

## Relevo (as únicas sombras permitidas)

**Uma luz só, vinda de cima.** Toda sombra externa só desce (deslocamento vertical, nunca
horizontal) e tem desfoque = **3 × deslocamento**; a única coisa que muda é a altura da peça.
Três elevações, cada uma com duas camadas (`globals.css`):

| Elevação   | Receita                                              | Onde                                                   |
| ---------- | ---------------------------------------------------- | ------------------------------------------------------ |
| `sunken`   | `inset 0 1px 3px afundado, inset 0 3px 9px afundado` | campos, trilhos, tarefa aberta, escolhido, pressionado |
| `resting`  | `0 1px 3px sombra, 0 3px 9px sombra-longe`           | placas, painéis, teclas                                |
| `floating` | `0 4px 12px sombra, 0 12px 36px sombra-longe`        | dock, folha, ajustes, "desfazer"                       |

Os oito tokens de uso são escritos sobre elas: `key`, `key-dark`, `key-accent`, `plate` =
`resting`; `pressed`, `field` = `sunken`; `float` = `floating`; `field-focus` = `sunken` com a
camada de longe mais funda. A cor da sombra muda com o tema e com o material onde a peça está
(placa ou painel). O card do dia, que muda de altura, usa a mesma elevação apoiada como
`drop-shadow` do conjunto (`--drop-resting`). O teste `design-tokens.test.ts` confere tudo isso.

**Sem contorno de 1 px.** A sombra define a peça. A única borda do app é a **borda de luz**: 1 px
com degradê vertical (`--edge-hi` em cima, some em 24 px), pintada no `border-box` por baixo da
cor da peça (`--fill`). Por estar no background, acompanha a curva do canto igual em toda peça
(antes, o filete `inset 0 1px 0` afinava até sumir nos cantos). Peça afundada (escolhida,
pressionada) apaga a luz. **Tecla sobe, campo afunda, o que está escolhido afunda.** A página
`/dev/sombras` (só em desenvolvimento) mostra as três elevações lado a lado nos dois temas.

## Foco

- **Campos de texto** (texto da tarefa, nota, adicionar tarefa): nada de contorno, borda ou anel.
  Focado, o campo **afunda mais** (`field-focus`) e o cursor fica verde (`accent`). Exceção: sobre
  o campo marfim do tema claro o verde dá 1,06:1 e some; ali o cursor é `ink`.
- **Botões e teclas**, só no teclado (`:focus-visible`, nunca no toque): contorno fino de 2 px na
  cor do texto do material (`ink` sobre placa, `ink-on-panel` sobre painel), afastado 2 px. Sem
  verde em volta.
- **Toque:** a tecla afunda (`pressed`) enquanto é pressionada; links e textos tocáveis ficam com
  opacidade 0,6.

## Formas e medidas

- Raios: **6** (caixa da tarefa, etiquetas), **12** (placas de virar, dias do calendário, grade de
  horário), **24** (placas, painéis, teclas pílula, campos), **28** (folha, nos quatro cantos).
  Tecla pílula = metade da altura.
- Teclas: altura **48** (barra inferior, ações da folha); **44** em todo o resto (topo, ajustes,
  grades da folha, ações da tarefa aberta). Alvo de toque nunca abaixo de 44 × 44.
- **Topo:** o mesmo em todas as telas autenticadas (dia, dia passado, dia distante, calendário,
  com a folha aberta por cima): wordmark 134×45 à esquerda e botão giratório à direita, abaixo da
  área segura de cima. As teclas "‹ Semana" / "‹ Calendário" ficam numa linha logo abaixo dele.
- **Peças flutuantes** (dock, folha, ajustes, "desfazer"): distância de baixo = 16 +
  `env(safe-area-inset-bottom)`; com o teclado aberto, 8 acima dele (`visualViewport`). A folha
  fica solta: 16 dos lados e embaixo, quatro cantos de 28, largura máxima da coluna (688),
  altura máxima da área visível com rolagem interna. A lista ganha espaço embaixo para a última
  tarefa nunca ficar atrás do dock. Alturas em `dvh`, nunca `vh`.
- Margem lateral **16**; espaçamento em 8 / 16 / 24 / 32.
- Tipografia (muda na fase 4): **Space Mono só** na wordmark, no título do dia (e do mês), nas
  placas de virar, no dial e nas horas (etiqueta, grade da folha). Todo o resto em **IBM Plex
  Sans**: rótulos, botões, seletor de tema, contagens, numeração, recorrência, calendário.
- Rótulos em texto normal ("Tarefas", "Hora", "Repetir", "Ajustes", "Nova tarefa"), sem linha ao
  lado: o espaço separa. **Caixa alta só nos nomes dos dias do dial** (e nas letras D S T Q Q S S).
  Os ajustes e a legenda do calendário perdem o tracejado; o tracejado fica só entre tarefas.
- Pílulas só onde têm função (teclas, campos, "desfazer", horário **atrasado**). O horário normal
  é texto, sem contorno; o horário escolhido na folha também.

## Telas (mockups em `docs/design/mockups/`)

| Mockup                 | Tela                                                                |
| ---------------------- | ------------------------------------------------------------------- |
| `RadioIII.dc.html`     | dia (lista) — **interativo**: tocar no dial move ponteiro e placas  |
| `V3Painel.dc.html`     | tarefa aberta: nota + Editar, ↑ ↓, Remover                          |
| `V3Edicao.dc.html`     | editar tarefa (folha de baixo): texto, nota, hora, minutos, repetir |
| `V3Calendario.dc.html` | calendário do mês                                                   |
| `V3Ajustes.dc.html`    | ajustes abertos pelo botão giratório                                |
| `V3Login.dc.html`      | entrar                                                              |
| `V3Noturno.dc.html`    | tema escuro (dia)                                                   |

### O que muda no comportamento

- **Muda: dias.** As faixas empilhadas saem. O **dial** (painel grafite) mostra os 7 dias
  (hoje + 6); tocar num dia move o **ponteiro verde** até ele e troca o card. O dia escolhido fica
  em verde; dias com tarefas têm um ponto embaixo do número. Deslizar horizontalmente no dial
  também troca de dia.
- **Muda: data do dia.** Duas **placas de virar** com o dia do mês (ver "Movimento"). Ao lado: nome do dia em Space Mono e "novembro · 14:35" /
  "novembro · amanhã" / "novembro · em 5 dias" / "novembro · ontem".
- **Muda: rótulo "Tarefas" com "1/4"** (feitas/total) à direita, e numeração 01, 02... em cada
  tarefa.
- **Muda: tarefa feita** = caixa verde **afundada** (`pressed`) com ✕ `on-accent`; texto
  `muted` riscado na cor do texto. Por fazer = caixa vazada com borda `ink` 2 px, sem sombra.
- **Muda: horário** à direita: normal = etiqueta com contorno; **atrasado = etiqueta verde**.
  Recorrente = "↻ diário" (ou os dias, ex. "↻ seg qua") em Plex.
- **Muda: "…" sai.** Tocar no **texto** da tarefa abre a tarefa no próprio card (fundo `sunken`):
  nota, **Editar**, **↑ ↓** (desativadas quando não se aplicam) e **Remover** (texto sublinhado).
  Tocar na caixa continua marcando.
- **Muda: edição** vira uma **folha que sobe de baixo** (`float`), com campo de texto, nota,
  grade de hora (06–23, link "madrugada (00 a 05)" e "minutos de 5 em 5"), minutos
  :00/:15/:30/:45, repetir por dia (escolhido = tecla escura afundada) e Cancelar / **Salvar**.
- **Muda: topo.** Wordmark (134×45) à esquerda e **um botão giratório** (44, `knob`, marquinha
  verde) à direita, que abre o **painel de ajustes** (`float`): tamanho do texto (A pequeno /
  indicador de 4 pontos / A grande), tema **Auto · Claro · Escuro** (Auto segue o iPhone, novo)
  e, embaixo, o e-mail da conta e "Sair". O link "sair" do topo e os ícones antigos saem.
- **Muda: barra inferior** flutuante (`float`): campo "Adicionar tarefa..." (afundado), tecla
  do calendário e **tecla verde "+"**. Respeita a área segura do iPhone.
- **Calendário:** botão "‹ Semana" (tecla clara) e o botão giratório no topo; card marfim com
  placas de virar do **número do mês**, "Novembro", "2026 · 3 pendentes", rótulo "Dias", grade de
  6 semanas; **hoje = tecla escura** com número e ponto verdes; futuro com tarefa = ponto `ink`;
  passado com histórico = número `muted` e ponto `off`; legenda "● pendente ● histórico".
  Barra inferior: "‹" (tecla escura), "Nov 2026" (afundado) e **"›" verde**, presa ao fundo.
- **Entrar:** wordmark grande, dial decorativo com o ponteiro em hoje, "A semana, sintonizada" (sem ponto),
  tecla escura larga "Entrar com Google" com o LED verde, "Só contas autorizadas podem entrar."
- **Dia passado / dia distante:** o mesmo card do dia; o passado mantém o aviso "Dia passado: só
  consulta" (etiqueta técnica) e nenhuma ação.
- **Kindle:** fora deste visual (rota leve própria, depois).

### Decisões tomadas na implementação (04/11/2026)

- **Adicionar:** com texto no campo, "+" (ou Enter) adiciona direto, sem horário, só no dia
  mostrado. Com o campo vazio, "+" abre a mesma folha da edição com o título **Nova tarefa**
  (texto, hora, minutos, repetir; sem nota). Na folha, "sem horário" limpa a hora.
- **Dia passado / distante:** o topo de sempre e, abaixo, a tecla clara "‹ Calendário"; sem dial. O distante mantém a barra de baixo para adicionar; o passado fica sem
  barra.
- **Calendário:** "N pendentes" = dias do mês, de hoje em diante, com tarefa avulsa não feita (a
  mesma regra do ponto). Dias anteriores à criação da conta ficam desativados (opacidade 0,4).
- **Entrar:** wordmark grande acima do dial, e o LED **sem** brilho (nenhuma sombra no LED).
- **Tarefa feita:** o horário some (como nos mockups); a recorrência continua.

## Movimento (fase 4)

**Só `transform` e `opacity`**; nunca `width`, `height`, `top`, `left`, `margin` ou `padding`.
Tokens em `globals.css`: uma **mola** criticamente amortecida, sem quique (`--ease-spring`, uma
`linear()` gerada de x(t) = 1 − (1 + ωt)·e^(−ωt), ω = 9,23, que chega a 99,9% no fim), e as
durações `--duration-press` 150 ms, `--duration-small` 350 ms (peças pequenas),
`--duration-sheet` 480 ms (folha), `--duration-fade` 150 ms. `--ease-in` só na metade de cima
da placa que cai. A animação nunca atrasa a ação: a tela muda na hora, o movimento vem por cima.
**Tudo que abre também fecha animando**, pelo mesmo caminho, e tocar de novo no meio parte de onde
a peça está (transição de CSS ou FLIP medido na tela): nada salta. `will-change` só durante o
movimento.

- **Tecla:** afunda na hora do toque (`pressed` e 1 px para baixo) e volta com a mola (`press`).
- **Ponteiro do dial:** `translateX` com a mola (`small`), junto com as placas. Arrastando o
  dial, segue o dedo.
- **Placas de virar (split-flap):** metade de cima e metade de baixo, linha do meio sempre à
  vista. Ao trocar, a metade de cima do algarismo antigo gira de 0 a −90° (`press`, `ease-in`,
  escurecendo), depois a de baixo do novo cai de 90° a 0° e assenta com a mola (`small`).
  `perspective` no pai, `backface-visibility: hidden`, eixo na linha do meio. Os dois algarismos
  viram separados, o da direita 60 ms depois; o que não mudou não vira. Trocar várias vezes
  rápido conclui a virada anterior na hora e começa a nova. Nome do dia e mês trocam com um fade
  curto (`fade`).
- **Tarefa abrindo/fechando no lugar (FLIP, `motion.ts`):** mede antes e depois e anima a
  diferença com `translateY`; o painel desliza de baixo da linha dentro de um recorte; o que está
  abaixo acompanha. A placa do card do dia é feita de três peças (topo fixo, meio com `scaleY`,
  pé com `translateY`), para a borda de baixo descer junto sem mudar a altura de nada. Fechando,
  o painel fica na tela até terminar de deslizar.
- **Folha:** `translateY` de fora da tela até o lugar (`sheet`), o fundo escurece em `opacity`;
  fecha descendo, e só então sai do modo modal e o foco volta.
- **Ajustes:** crescem do botão giratório (`transform-origin` no centro dele, `scale` 0,2 → 1 e
  `opacity`, `small`) e recolhem para ele. A marquinha do botão gira com a mola.
- **Tema:** muda na hora do toque (classe no `<html>`); por um quadro, `theme-switch` desliga as
  transições para tudo trocar de uma vez, e o salvamento vem depois do quadro. A opção escolhida
  é uma peça escura que desliza com a mola.
- **Movimento reduzido** (`prefers-reduced-motion`): nada se desloca; teclas, ponteiro, placas e
  tema trocam na hora; folha, ajustes e tarefa aberta aparecem (e folha e ajustes somem) com um
  fade de 150 ms.

## Gestos (fase 4)

Pointer events, sem dependência (`src/app/_components/swipe.ts`).

- **Tarefa:** deslizar para a direita conclui (ou reabre); para a esquerda remove, com o desfazer.
  A tarefa segue o dedo e revela por baixo um campo afundado com **Feita** / **Reabrir** ou
  **Remover**. Passou de 96 px: concluir acende o verde (`accent`), remover escurece (`panel`); sem
  vermelho. Depois do limite a tarefa resiste ao dedo. Soltar antes do limite volta ao lugar.
  Tarefa aberta não desliza.
- **Dial:** deslizar move o ponteiro com o dedo; ao soltar, vai para o dia mais perto (no mínimo um
  dia, a partir de 32 px).
- Gestos que começam a menos de **24 px** das bordas da tela são do Safari e são ignorados. Só é
  gesto se o movimento for claramente horizontal (|dx| > 2·|dy|, depois de 10 px); senão, é
  rolagem.
- Todo gesto tem equivalente por toque e teclado (a caixa, o Remover da tarefa aberta, os dias do
  dial), e o resultado é anunciado aos leitores de tela ("Treino: feita.", "quinta 05", e o
  "removida" do desfazer).

## Acessibilidade (obrigatório, mantido)

- Tarefa é `role="checkbox"` com `aria-checked`; botões só-símbolo têm `aria-label`.
- Dial: cada dia é um botão com `aria-pressed` e rótulo "quarta 04, com tarefas".
- Placas de virar: `role="img"` com o dia por extenso.
- Contorno de foco só no teclado (`:focus-visible`), como em "Foco" acima.
- Todo texto ≥ 4,5:1. Esc fecha folha/ajustes/tarefa aberta e volta uma tela.
