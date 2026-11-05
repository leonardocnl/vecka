# Vecka

As tarefas da semana, dia a dia. App web pensado para o iPhone (Safari e "Adicionar à Tela de Início"), com login pelo Google e histórico dos dias passados.

Em produção em https://dievecka.vercel.app (entrada restrita aos e-mails autorizados).

## Funções

- Semana de 7 dias com um dia em foco: adicionar, marcar, editar e remover tarefas, com desfazer
- Tarefas avulsas ou recorrentes por dia da semana, com horário e nota opcionais
- Ordem manual (↑ ↓) e atualização otimista
- Calendário com os dias passados abertos só para consulta
- Gestos: deslizar a tarefa para a direita conclui, para a esquerda remove
- Tema claro e escuro e tamanho da letra salvos por aparelho
- Animações curtas, desligadas com `prefers-reduced-motion`

## Stack

- Next.js 16 (App Router), React 19 e TypeScript (strict), em Node 24
- Tailwind CSS 4
- Postgres no Neon, com Drizzle ORM e `@neondatabase/serverless`
- zod para validar a entrada de toda server action
- Vitest, ESLint e Prettier
- Vercel (região `gru1`); CI e varredura de segurança (gitleaks, Semgrep, `npm audit`) no GitHub Actions

## Decisões técnicas

- **Login próprio:** OAuth 2.0 com PKCE no Google, implementado sem biblioteca de autenticação, com sessões no banco (só o hash do token, expiração por inatividade e absoluta).
- **Camadas:** `domain` → `application` → `infrastructure` → `app`, com dependências só para dentro.
- **Isolamento por usuário:** o usuário vem sempre da sessão e toda consulta filtra por ele. Testes de ataque num Postgres real conferem que ninguém lê nem altera tarefas de outra pessoa.
- **Histórico consistente:** tarefas removidas usam exclusão lógica, e o servidor recusa escrita em dias passados.
- Base de segurança completa em [`docs/security.md`](docs/security.md).

## Como rodar localmente

Requer Node 24 (veja `.nvmrc`), um banco Postgres e um cliente OAuth do Google ("Aplicativo da Web") com o redirecionamento `http://localhost:3000/api/auth/google/callback`.

```bash
npm install
cp .env.example .env.local   # preencha os valores; ALLOWED_EMAILS vazio = ninguém entra
npm run db:migrate
npm run dev
```

Abra http://localhost:3000.

## Scripts

| Script                | O que faz                                         |
| --------------------- | ------------------------------------------------- |
| `npm run dev`         | Servidor de desenvolvimento                       |
| `npm run build`       | Build de produção                                 |
| `npm test`            | Testes com Vitest                                 |
| `npm run test:db`     | Testes de ataque num Postgres local e descartável |
| `npm run lint`        | ESLint                                            |
| `npm run typecheck`   | Gera os tipos das rotas e checa os tipos          |
| `npm run db:generate` | Gera uma migration com o Drizzle                  |
| `npm run db:migrate`  | Aplica as migrations                              |
