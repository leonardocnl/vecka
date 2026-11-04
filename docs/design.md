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

| Token          | Claro     | Escuro    | Uso                                                          |
| -------------- | --------- | --------- | ------------------------------------------------------------ |
| `paper`        | `#E7E4DC` | `#1A1A19` | fundo, com grão (ver Textura)                                |
| `plate`        | `#F3F1EB` | `#262624` | placa: card do dia, card do calendário, folhas, ajustes      |
| `plate-ring`   | `#CFCBC2` | `#333331` | contorno de 1px das placas                                   |
| `panel`        | `#232321` | `#0F0F0E` | painel: dial, barra inferior, placas de virar, tecla de hoje |
| `panel-ring`   | `#151514` | `#000000` | contorno de 1px dos painéis                                  |
| `key-dark`     | `#3A3A37` | `#2B2B28` | tecla escura sobre painel                                    |
| `knob`         | `#2B2B28` | `#2B2B28` | botão giratório de ajustes                                   |
| `sunken`       | `#E9E6DE` | `#1E1E1C` | campo afundado sobre placa                                   |
| `sunken-dark`  | `#2B2B28` | `#1E1E1C` | campo afundado sobre painel                                  |
| `flap-top`     | `#2B2B28` | `#161615` | metade de cima da placa de virar                             |
| `ink`          | `#1E1E1E` | `#EDEAE1` | texto principal, bordas da caixa de tarefa, régua            |
| `ink-on-panel` | `#EDEAE1` | `#EDEAE1` | texto sobre painel                                           |
| `muted`        | `#4F4E4B` | `#A9A8A4` | texto secundário, etiquetas técnicas                         |
| `muted-panel`  | `#A9A8A4` | `#A9A8A4` | texto secundário sobre painel                                |
| `index`        | `#5C5B58` | `#A9A8A4` | numeração 01, 02... e dias passados no calendário            |
| `done-text`    | `#575653` | `#A3A29E` | texto da tarefa feita (riscado na cor do texto, não verde)   |
| `rule-dashed`  | `#C4C1B9` | `#3E3E3B` | tracejado entre tarefas                                      |
| `tick-major`   | `#EDEAE1` | `#EDEAE1` | marcações principais do dial                                 |
| `tick-minor`   | `#55554F` | `#4A4A46` | marcações menores do dial e linha base                       |
| `history-dot`  | `#8E8D89` | `#8E8D89` | ponto de "histórico" no calendário                           |
| `accent`       | `#C4F000` | `#C4F000` | verde ácido: ponteiro, tecla principal, feita, atrasado, LED |
| `on-accent`    | `#1E1E1E` | `#1E1E1E` | texto e ícones sobre o verde                                 |

Regras do verde:

- **O verde só aparece como preenchimento** (tecla, etiqueta, caixa feita, ponteiro, LED) ou
  como **texto sobre painel escuro** (dia selecionado no dial, número de hoje no calendário).
  Nunca como texto ou ponto pequeno sobre placa/papel claros: o contraste é baixo demais.
- **Uma tecla verde por tela**: a ação principal (adicionar, próximo mês, salvar).
- Sobre o verde, sempre `on-accent` (contraste ≥ 12:1).
- Erros: etiqueta `panel` com texto `ink-on-panel` e um ponto verde à esquerda (o LED).

## Textura

Grão de papel em toda a tela: `feTurbulence` (fractalNoise, baseFrequency 0.9, 3 oitavas) por
cima do fundo, `mix-blend-mode: multiply`, opacidade 0,55 no claro; no escuro, `screen` com
grão claro e opacidade 0,35 (ver `RadioIII.dc.html` e `V3Noturno.dc.html`). Sem
`pointer-events`. Pode virar uma imagem estática pequena se o SVG pesar no iPhone.

## Relevo (as únicas sombras permitidas)

Um conjunto fechado de oito sombras, em `globals.css` (`--shadow-*`). Nenhum `box-shadow` fora
delas (o teste `design-tokens.test.ts` confere). **A luz vem de cima:** brilho de 1 px na borda de
cima, sombra para baixo, a mesma direção e o mesmo desfoque em todas as telas e nos dois temas.
**Tecla sobe, campo afunda, o que está escolhido afunda.**

| Nome          | Onde                                                                    | Receita (claro)                                                           |
| ------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `key`         | tecla clara (Semana, Editar, ↑ ↓, grades da folha, Cancelar, A A)       | `inset 0 1px 0 brilho, 0 0 0 1px contorno, 0 1px 2px rgba(40,30,10,.14)`  |
| `key-dark`    | tecla escura: dock, botão giratório, Entrar, hoje no calendário, placas | `inset 0 1px 0 rgba(255,255,255,.08), 0 1px 2px rgba(0,0,0,.40)`          |
| `key-accent`  | tecla verde: "+", "›", Salvar                                           | `inset 0 1px 0 rgba(255,255,255,.45), 0 1px 2px rgba(0,0,0,.40)`          |
| `pressed`     | tarefa feita, opção escolhida, tema escolhido, tecla durante o toque    | `inset 0 1px 2px rgba(0,0,0,.28)` — **aprovado, é a referência**          |
| `field`       | campos, trilhos (tamanho do texto, tema), tarefa aberta                 | `inset 0 1px 2px fundo, 0 0 0 1px contorno`                               |
| `field-focus` | campo de texto focado: afunda mais                                      | `inset 0 1px 2px fundo, inset 0 2px 8px fundo, 0 0 0 1px contorno`        |
| `plate`       | placas e painéis em repouso (card, calendário, dial)                    | `inset 0 1px 0 brilho, 0 0 0 1px contorno, 0 4px 12px rgba(40,30,10,.12)` |
| `float`       | o que flutua sobre o conteúdo: dock, folha, ajustes, "desfazer"         | `inset 0 1px 0 brilho, 0 0 0 1px contorno, 0 8px 24px rgba(40,30,10,.24)` |

Brilho, contorno e fundo dependem do **material**:

| Material        | brilho                  | contorno     | fundo do campo       |
| --------------- | ----------------------- | ------------ | -------------------- |
| placa (claro)   | `#FFF`                  | `plate-ring` | `rgba(40,30,10,.18)` |
| painel (claro)  | `rgba(255,255,255,.09)` | `panel-ring` | `rgba(0,0,0,.45)`    |
| placa (escuro)  | `rgba(255,255,255,.06)` | `plate-ring` | `rgba(0,0,0,.45)`    |
| painel (escuro) | `rgba(255,255,255,.05)` | `panel-ring` | `rgba(0,0,0,.60)`    |

No escuro as quedas usam preto: `key` .40, `key-dark`/`key-accent` .60, `plate` .40, `float` .55,
`pressed` .35. A página `/dev/sombras` (só em desenvolvimento) mostra todas lado a lado nos dois
temas.

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
- Tipografia: Space Mono Bold (datas, dias, horários, números, etiquetas técnicas em 10–11 px com
  letter-spacing 1–2 px); IBM Plex Sans (texto). Mantidos da v2.

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
- **Muda: data do dia.** Duas **placas de virar** com o dia do mês; ao trocar de dia, a metade de
  cima "cai" (rotateX, 200 ms). Ao lado: nome do dia em Space Mono e "novembro · 14:35" /
  "novembro · amanhã" / "novembro · em 5 dias" / "novembro · ontem".
- **Muda: régua "TAREFAS ──── 1/4"** (feitas/total) e numeração 01, 02... em cada tarefa.
- **Muda: tarefa feita** = caixa verde **afundada** (`pressed`) com ✕ `on-accent`; texto
  `done-text` riscado na cor do texto. Por fazer = caixa vazada com borda `ink` 2 px, sem sombra.
- **Muda: horário** à direita: normal = etiqueta com contorno; **atrasado = etiqueta verde**.
  Recorrente = "↻ DIÁRIO" (ou os dias, ex. "↻ SEG QUA") em Space Mono.
- **Muda: "…" sai.** Tocar no **texto** da tarefa abre a tarefa no próprio card (fundo `sunken`):
  nota, **Editar**, **↑ ↓** (desativadas quando não se aplicam) e **Remover** (texto sublinhado).
  Tocar na caixa continua marcando.
- **Muda: edição** vira uma **folha que sobe de baixo** (`float`), com campo de texto, nota,
  grade de hora (06–23, link "madrugada (00 a 05)" e "minutos de 5 em 5"), minutos
  :00/:15/:30/:45, repetir por dia (escolhido = tecla escura afundada) e Cancelar / **Salvar**.
- **Muda: topo.** Wordmark (134×45) à esquerda e **um botão giratório** (44, `knob`, marquinha
  verde) à direita, que abre o **painel de ajustes** (`float`): tamanho do texto (A pequeno /
  indicador de 4 pontos / A grande), tema **AUTO · CLARO · ESCURO** (AUTO segue o iPhone, novo)
  e, embaixo, o e-mail da conta e "Sair". O link "sair" do topo e os ícones antigos saem.
- **Muda: barra inferior** flutuante (`float`): campo "Adicionar tarefa..." (afundado), tecla
  do calendário e **tecla verde "+"**. Respeita a área segura do iPhone.
- **Calendário:** botão "‹ Semana" (tecla clara) e o botão giratório no topo; card marfim com
  placas de virar do **número do mês**, "NOVEMBRO", "2026 · 3 pendentes", régua "DIAS", grade de
  6 semanas; **hoje = tecla escura** com número e ponto verdes; futuro com tarefa = ponto `ink`;
  passado com histórico = número `index` e ponto `history-dot`; legenda "● pendente ● histórico".
  Barra inferior: "‹" (tecla escura), "NOV 2026" (afundado) e **"›" verde**, presa ao fundo.
- **Entrar:** wordmark grande, dial decorativo com o ponteiro em hoje, "A semana, sintonizada.",
  tecla escura larga "Entrar com Google" com o LED verde, "Só contas autorizadas podem entrar."
- **Dia passado / dia distante:** o mesmo card do dia; o passado mantém o aviso "Dia passado: só
  consulta" (etiqueta técnica) e nenhuma ação.
- **Kindle:** fora deste visual (rota leve própria, depois).

### Decisões tomadas na implementação (04/11/2026)

- **Adicionar:** com texto no campo, "+" (ou Enter) adiciona direto, sem horário, só no dia
  mostrado. Com o campo vazio, "+" abre a mesma folha da edição com o título **NOVA TAREFA**
  (texto, hora, minutos, repetir; sem nota). Na folha, "sem horário" limpa a hora.
- **Dia passado / distante:** o topo de sempre e, abaixo, a tecla clara "‹ Calendário"; sem dial. O distante mantém a barra de baixo para adicionar; o passado fica sem
  barra.
- **Calendário:** "N pendentes" = dias do mês, de hoje em diante, com tarefa avulsa não feita (a
  mesma regra do ponto). Dias anteriores à criação da conta ficam desativados (opacidade 0,4).
- **Entrar:** wordmark grande acima do dial, e o LED **sem** brilho (só as sombras da tabela).
- **Tarefa feita:** o horário some (como nos mockups); a recorrência continua.

## Animações (fase 4)

Curtas (150–250 ms, `ease-out`), todas desligadas com `prefers-reduced-motion`:
ponteiro deslizando no dial; placas de virar; tecla afundando ao tocar (`pressed`); tarefa abrindo
no card; folha subindo; painel de ajustes abrindo a partir do botão giratório.

## Acessibilidade (obrigatório, mantido)

- Tarefa é `role="checkbox"` com `aria-checked`; botões só-símbolo têm `aria-label`.
- Dial: cada dia é um botão com `aria-pressed` e rótulo "quarta 04, com tarefas".
- Placas de virar: `role="img"` com o dia por extenso.
- Contorno de foco só no teclado (`:focus-visible`), como em "Foco" acima.
- Todo texto ≥ 4,5:1. Esc fecha folha/ajustes/tarefa aberta e volta uma tela.
