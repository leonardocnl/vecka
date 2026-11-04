# Vecka v2 — plano

Reescrita do Vecka para a web, com foco no iPhone (Safari e "Adicionar à Tela de Início").
A versão atual (`index.html` em ES5, modo demonstração) é a referência de comportamento e visual.

## Decisões do Leonardo

| Tema           | Decisão                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------ |
| Público        | Começa só com ele; pode virar portfólio aberto a qualquer pessoa depois                    |
| Login          | **Google**, implementado à mão (OAuth 2.0 + PKCE) com sessões no banco, como no Kinne      |
| Histórico      | **Guardar tudo**; dias passados abrem no calendário **só para consulta**                   |
| Stack          | A mesma do Kinne (abaixo)                                                                  |
| Hospedagem     | Vercel, projeto `vecka` → `vecka.vercel.app`                                               |
| Recursos novos | **Animações sutis**, **gestos de deslizar**, **lembrete no horário** (notificação)         |
| Fora do escopo | Offline                                                                                    |
| Kindle         | Depois, numa rota leve separada (`/kindle`, HTML do servidor, sem JS moderno)              |
| Repositório    | Este mesmo (`leonardocnl/vecka`), com o fluxo do Kinne: `main` / `develop` / branches + PR |
| Autoria        | Commits e PRs **só em nome do Leonardo**, sem `Co-Authored-By` nem menção ao Claude        |

## Stack (igual ao Kinne)

- Node 24, Next.js (App Router), React, TypeScript strict, Tailwind CSS 4, ESLint, Prettier, Vitest.
- Postgres no **Neon**, via Drizzle ORM e `@neondatabase/serverless`.
- Vercel **sem** recursos exclusivos (nada de Vercel KV, Postgres, Blob ou Cron).
- Camadas em `src/`: `domain` → `application` → `infrastructure` → `app` (dependências só para dentro).
- Mesma base de segurança do Kinne (`docs/security.md` a criar a partir do dele): sem segredos no
  cliente, `server-only`, zod estrito em toda server action, CSP, erros genéricos, sem query params.
- Dependências novas previstas, a confirmar com o Leonardo quando chegar a hora: `web-push`
  (lembretes). Nenhuma outra sem perguntar.

## Modelo de dados

- `users` — `id`, `google_sub` (único), `email`, `name`, `created_at`.
- `user_sessions` — como no Kinne: `token_hash`, `expires_at`, `absolute_expires_at`, `last_used_at`.
- `tasks` — `id`, `user_id`, `text` (≤300), `date` (avulsa) **ou** `recurring_days smallint[]`,
  `time` (`HH:MM`, opcional), `note` (≤1000, opcional), `position` (ordem manual), `created_at`,
  `deleted_at` (exclusão lógica: o histórico continua consistente).
- `task_completions` — `task_id`, `date`, `completed_at`; PK (`task_id`, `date`). Substitui o
  array `done_dates` e preserva o histórico das recorrentes.
- `push_subscriptions` — `user_id`, `endpoint`, `p256dh`, `auth`, `created_at`.
- `reminders_sent` — `task_id`, `date`; evita notificar duas vezes.
- Toda consulta filtra por `user_id` da sessão; nada é acessível sem sessão.

## Comportamento novo

- **Histórico:** nada é apagado à meia-noite. No calendário, dias passados deixam de ser bloqueados
  e abrem em modo leitura (sem adicionar, marcar ou editar), com a data e o que foi feito.
  A navegação para meses anteriores passa a ser liberada.
- **Animações:** abrir/fechar dia, ✕ sendo "desenhado" ao marcar, painel do "…", troca de mês.
  Curtas (150–250ms), via CSS ou `motion` (já usado no Kinne), e desligadas com
  `prefers-reduced-motion`.
- **Gestos:** deslizar a tarefa para a **direita conclui**, para a **esquerda remove** (com o
  "desfazer"). Ignorar gestos que começam a 24px das bordas (o Safari usa a borda para "voltar").
- **Lembretes:** notificação no horário da tarefa. Só funciona com o Vecka na Tela de Início
  (iOS 16.4+); o app explica isso e pede permissão num momento claro, nunca ao abrir.
  Disparo: um endpoint protegido por segredo, chamado a cada minuto por um agendador externo.
  O Vercel Cron no plano gratuito só roda 1×/dia e o GitHub Actions atrasa minutos, então a
  recomendação é o **cron-job.org** (gratuito, a cada minuto). **Decidir com o Leonardo na fase 5.**

## Fases (uma branch e um PR por fase, todos para `develop`)

0. **Base** — mover a versão atual para `legacy/`; criar o projeto Next com a estrutura, as
   ferramentas e a CI do Kinne; `CLAUDE.md`, `AGENTS.md`, `docs/security.md`; página vazia com a
   wordmark. Checks verdes.
1. **Login** — Google OAuth + PKCE, sessões no banco, `/entrar`, sair, proteção de todas as rotas.
2. **Tarefas** — portar tudo da versão atual: lista de 7 dias, dia em foco, adicionar/marcar/
   editar/remover com desfazer, recorrentes, horário em grade, notas, ↑ ↓, calendário, dia
   distante, tema, tamanho da letra, atualização otimista, acessibilidade.
3. **Histórico** — dias passados em modo leitura no calendário.
4. **Animações e gestos.**
5. **Lembretes** — Web Push, permissão, envio no horário, agendador.
6. **Produção** — deploy em `vecka.vercel.app`, revisão de segurança, `main`.
7. **(Depois)** rota `/kindle`.

## O que só o Leonardo pode fazer (contas e segredos)

1. **Neon:** criar o projeto `vecka` e copiar a connection string.
2. **Google Cloud:** criar o cliente OAuth (tipo "Aplicativo da Web") e copiar o ID e o segredo.
   Origens/redirecionamentos: `http://localhost:3000/api/auth/google/callback` e, na fase 6,
   `https://vecka.vercel.app/api/auth/google/callback`.
3. **Vercel:** importar o repositório com o nome `vecka` (fase 6) e colar as variáveis de ambiente.
4. **Fase 5:** criar a conta no agendador escolhido.

Os segredos vão só no `.env.local` e nas variáveis da Vercel, nunca no chat nem no Git.
