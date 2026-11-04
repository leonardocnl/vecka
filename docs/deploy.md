# Deploy na Vercel

- Produção: `https://dievecka.vercel.app`, publicada a partir da `develop`.
- Node: `engines.node: "24.x"` no `package.json` (a Vercel usa essa versão).
- Região das funções: `gru1` (São Paulo), fixada no `vercel.json`, ao lado do Neon em `sa-east-1`.
- O build não depende de nenhum arquivo local: tudo vem do Git e das variáveis abaixo.

## Variáveis de produção

Só os nomes; os valores ficam no painel da Vercel (Settings → Environment Variables, ambiente
Production) e nunca no repositório.

| Nome                   | De onde vem                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `APP_URL`              | Fixo: `https://dievecka.vercel.app` (origem do `redirect_uri` e de toda URL absoluta)    |
| `DATABASE_URL_POOLED`  | Neon → Connect → connection string **com pooler** (host com `-pooler`)                   |
| `GOOGLE_CLIENT_ID`     | Google Cloud Console → APIs e serviços → Credenciais → cliente OAuth "Aplicativo da Web" |
| `GOOGLE_CLIENT_SECRET` | O mesmo cliente OAuth do Google                                                          |
| `ALLOWED_EMAILS`       | Definida por você: e-mails que podem entrar, separados por vírgula                       |

`DATABASE_URL` (conexão direta do Neon, usada só pelas migrations com `npm run db:migrate`) **não**
vai para a Vercel: as migrations rodam da máquina local.

No cliente OAuth do Google, cadastre o redirecionamento
`https://dievecka.vercel.app/api/auth/google/callback`.
