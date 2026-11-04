# Vecka — design

Decisões visuais já aprovadas pelo Leonardo. Não mudar sem perguntar. A versão atual
(`index.html`, em ES5) é a referência viva: em caso de dúvida, ela mostra o comportamento certo.

## Cores

Uma cor de destaque só, sem variações de tom.

| Token        | Claro     | Escuro    | Uso                                                         |
| ------------ | --------- | --------- | ----------------------------------------------------------- |
| `paper`      | `#E3E2DE` | `#2F2F2F` | fundo (com textura de papel, `public/paper.png`)            |
| `ink`        | `#1E1E1E` | `#E4E3DF` | texto principal, bordas de caixas e botões                  |
| `ink-open`   | `#1E1E1E` | `#F0EFEB` | nome do dia aberto                                          |
| `muted`      | `#4F4E4B` | `#B3B2AE` | texto secundário (data, dicas, ícones, contadores)          |
| `day-closed` | `#5C5B58` | `#A9A8A4` | nome dos dias recolhidos e placeholder                      |
| `done-text`  | `#575653` | `#A3A29E` | texto da tarefa concluída                                   |
| `line`       | `#A8A7A3` | `#555555` | linhas entre os dias                                        |
| `signal`     | `#CF1020` | `#CF1020` | ✕ da tarefa feita, risco, ponto do calendário, foco, atraso |
| `field`      | `#8E8D89` | `#7A7976` | linha dos campos de texto e borda da nota (do legacy)       |
| `disabled`   | `#8E8D89` | `#77766F` | dia passado no calendário (desabilitado, do legacy)         |

- **O vermelho é sempre `#CF1020`, nos dois temas.** Onde ele é _texto_ (horário atrasado,
  aviso de erro), vira **fundo de etiqueta com texto branco** (contraste 5,6:1).
- No tema escuro, o foco ganha um anel claro (`#E4E3DF`) em volta do contorno vermelho.
- Todo texto tem contraste ≥ 4,5:1 (WCAG AA); conferir ao criar qualquer cor nova.

## Tipografia

- **Títulos (nomes dos dias, mês do calendário, horários):** Space Mono **Bold pura**, sem
  contorno nem espaçamento alterado.
- **Todo o resto:** IBM Plex Sans (regular e bold).
- Nada de SF Pro (licença da Apple não permite servir o arquivo).

## Espaçamento

- Escala de 8 em 8: **8, 16, 24, 32, 48**. Nenhum valor solto.
- Margem lateral única: **24px**; **16px** em telas até 480px. Wordmark, status, dias, tarefas,
  "voltar" e calendário começam na mesma coluna.
- Alvos de toque com pelo menos **44–48px**.

## Componentes e comportamento

- **Topo:** wordmark (`public/wordmark.svg`, 132×44; 105×35 no celular) à esquerda; à direita,
  ícones desenhados: "A" pequeno / "A" grande (tamanho da letra, 4 passos: 0,85 / 1 / 1,15 / 1,3)
  e círculo meio preenchido (tema). Sem botão "atualizar". No Kindle, ícone de borracha (limpar tela).
- **Lista:** hoje + 6 dias, na ordem. O dia tocado abre **no próprio lugar** (o nome fica parado
  sob o dedo); os outros recolhidos e em `day-closed`. Recolhido mostra a data (`31/10`) ou a
  etiqueta "hoje", e o número de pendentes numa caixinha com borda.
- **Data do dia aberto:** "30 de outubro de 2026 — 13:05" (hoje, com hora), "— amanhã",
  "— em 19 dias".
- **Faixa "CALENDÁRIO"** no fim da lista, no mesmo estilo dos dias, sem seta.
- **Tarefa:** caixa vazada 26px; feita = **✕ vermelho "de caneta"** (dois traços levemente
  desiguais) + texto riscado em vermelho. Ordem: com horário (crescente) → sem horário (ordem
  manual) → feitas. Horário à direita, em Space Mono; atrasado = etiqueta vermelha.
  Ícone discreto de documento quando há nota.
- **"…":** abre painel embaixo da tarefa com a nota, **Editar**, **↑ ↓** (só sem horário e não
  feitas) e **Remover**. Remover apaga na hora e mostra faixa "desfazer" por 6s.
- **Horário:** grade de toques. Horas 06–23 (6 por linha), link "madrugada (00 a 05)"; minutos
  00/15/30/45, link "mais minutos (de 5 em 5)". "Horário: **14:30** limpar".
- **Calendário:** grade do mês começando no domingo, **sempre 6 semanas**, centralizada na
  altura livre. Barra "‹ NOVEMBRO 2026 ›" **presa ao fundo** (32px + área segura do iPhone),
  sem se mexer ao trocar de mês. Hoje com borda grossa; ponto vermelho = tarefa avulsa pendente.
- **Links de navegação:** só texto ("voltar", "calendário"), sem setas.

## Acessibilidade (obrigatório)

- Tarefa é `role="checkbox"` com `aria-checked`; botões só-símbolo têm `aria-label`.
- Contorno de foco só no teclado (`:focus-visible`).
- Nomes dos dias são títulos (`h2`). Esc fecha edição/menu e volta uma tela.
- Animações respeitam `prefers-reduced-motion`.
