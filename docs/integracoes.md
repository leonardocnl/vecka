# Integrações (API por chave)

Uma automação (ex.: n8n) cria e atualiza tarefas da sua conta por duas rotas. Sem sessão: a
autenticação é a chave no cabeçalho `Authorization: Bearer <chave>`.

## Configurar

1. Gere a chave (64 caracteres hexadecimais; o mínimo aceito é 32):

   ```sh
   openssl rand -hex 32
   ```

2. Defina as duas variáveis. Se faltar qualquer uma, as rotas respondem 404.

   | Nome                     | Valor                                                    |
   | ------------------------ | -------------------------------------------------------- |
   | `INTEGRATION_API_KEY`    | A chave gerada acima                                     |
   | `INTEGRATION_USER_EMAIL` | O e-mail da sua conta Google no Vecka (dono das tarefas) |
   - **Vercel:** Settings → Environment Variables, ambiente **Production**, e faça um novo deploy.
     Não coloque a chave de produção em Preview.
   - **Local:** no `.env.local` (fora do Git). Use outra chave, não a de produção.

3. No n8n, guarde a chave numa credencial "Header Auth" (`Authorization` / `Bearer <chave>`),
   nunca no corpo do fluxo.

A conta precisa já existir (entre no app uma vez). Para trocar a chave, gere outra, atualize a
variável e a credencial do n8n.

## Rotas

`POST /api/integrations/tasks/upsert`

```json
{
  "externalSource": "n8n",
  "externalId": "evento-123",
  "title": "Reunião",
  "dueAt": "2026-11-16T10:00:00-03:00",
  "notes": "opcional",
  "url": "https://exemplo.com/opcional"
}
```

- Cria (`{ "id": 1, "action": "created" }`) ou atualiza pela chave `externalSource` +
  `externalId` (`"updated"` ou `"unchanged"`). Repetir o mesmo corpo não muda nada.
- `dueAt` precisa de fuso (`Z` ou `-03:00`); vira dia e hora no fuso da conta. Sem `dueAt`, a
  tarefa fica sem hora (na criação, no dia de hoje). Um dia que já passou é recusado.
- `notes` e `url` ausentes apagam o valor guardado: mande sempre o estado completo.
- Tarefa concluída continua concluída (mesmo mudando de dia). Tarefa que você removeu não volta.
  Tarefa de um dia que já passou não muda.
- Limites: `externalSource` até 64 (letras, números, `. _ : -`), `externalId` até 255, `title`
  até 300, `notes` até 1000, `url` (http/https) até 2048.

`GET /api/integrations/tasks?date=AAAA-MM-DD`

Pendentes do dia (avulsas e recorrentes, no fuso da conta, `America/Sao_Paulo` por padrão):
`[{ "id", "title", "dueAt", "done", "externalSource" }]`. `dueAt` vem em UTC, ou `null` se a
tarefa não tem hora.

Respostas de erro: `401` (chave errada, sem corpo), `400` (`{ "error": "invalid" }`), `429`
(mais de ~2 pedidos por segundo), `500` (`{ "error": "unavailable" }`; o motivo só no log).
