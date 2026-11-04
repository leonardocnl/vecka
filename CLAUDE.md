# Vecka — instruções para o Claude

@AGENTS.md

**Antes de qualquer tarefa de interface, leia [docs/design.md](docs/design.md)** (decisões visuais aprovadas). O plano da v2 está em [docs/plano-v2.md](docs/plano-v2.md).

Lista de tarefas da semana (hoje + 6 dias), feita para o iPhone (Safari e "Adicionar à Tela de Início"). A versão anterior, em ES5, está em `legacy/` sem alterações: é a referência de comportamento e visual. Não edite nada em `legacy/`.

## Decisões (não mudar sem perguntar ao usuário)

- **Runtime:** Node 24 (`.nvmrc`, `engines.node: "24.x"`). `@types/node` acompanha a versão do Node (hoje `^24`).
- **Stack:** a mesma do Kinne: Next.js (App Router), React, TypeScript strict, Tailwind CSS 4, ESLint, Prettier, Vitest.
- **Banco:** Postgres no Neon, via Drizzle ORM e `@neondatabase/serverless`. (Ainda não configurado.)
- **Hospedagem:** Vercel (`vecka.vercel.app`), sem recursos exclusivos dela (nada de Vercel KV, Postgres, Blob ou Cron).
- **Arquitetura em camadas em `src/`:**
  - `domain`: regras puras, sem dependência de framework.
  - `application`: casos de uso.
  - `infrastructure`: banco, autenticação, push, cabeçalhos HTTP.
  - `app`: rotas e componentes do Next.
  - Dependências só apontam para dentro: app → application → domain. A infrastructure implementa interfaces definidas em domain/application.
- **Segredos:** só em variáveis de ambiente (veja `.env.example`). `.env.local` nunca vai para o Git.
- **Fontes** (via `next/font/google`): Space Mono Bold nos títulos (`font-title`) e IBM Plex Sans no resto (`font-sans`).
- **Cores e espaçamentos:** tokens do Tailwind em `src/app/globals.css`, exatamente como em docs/design.md. Um vermelho só, `#CF1020` (`signal`), sem variações. Fora do `globals.css`, nada de hex, px ou valores arbitrários (`src/app/design-tokens.test.ts`).
- **Idioma:** interface em pt-BR. Código, nomes de arquivos e commits em inglês; comentários podem ser em português.
- **Formatação:** o Prettier é a fonte da verdade (`.prettierrc.json`). Indentação de 4 espaços, linhas de até 100 caracteres. O ESLint não cuida de formatação (`eslint-config-prettier`).
- **Dependências:** não adicionar nenhuma sem perguntar.
- **Autoria:** commits e PRs só em nome de Leonardo Carvalho Silva <leonardocnl.dev@gmail.com>. Sem `Co-Authored-By`, sem "Generated with" e sem nenhuma menção ao Claude.

## Antes de commitar

`npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` precisam passar.

## Branch workflow

- `main` = production. Never push to it directly.
- `develop` = integration. Never push to it directly; it only changes through merged PRs.
- `feat/…`, `fix/…`, `docs/…` = short-lived task branches, one per phase or task, in kebab-case (e.g. `feat/v2-login`). Branch off `develop` and open the PR into `develop`.

## Security

Leia [docs/security.md](docs/security.md) antes de qualquer tarefa que mexa em entrada de dados, rotas, segredos, dependências ou CI. Regras inegociáveis (exceção só registrada em "Accepted risks"):

- Nenhum query param em URLs; a URL leva só o caminho. Estado transitório vai em `sessionStorage` ou `history.state`.
- Nenhum segredo em código de cliente: módulos com segredo ou banco importam `server-only`, e nenhum segredo usa o prefixo `NEXT_PUBLIC_`.
- Schemas zod estritos (chaves desconhecidas rejeitadas) em toda server action.
- Toda consulta filtra pelo `user_id` da sessão.
- Nenhuma saída de console em produção.
- Nada de `dangerouslySetInnerHTML`.
- Erros para o usuário sempre genéricos; detalhe só no log do servidor.
- Todo PR preenche o checklist de segurança do template.
