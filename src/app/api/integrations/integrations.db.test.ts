import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, todayIn } from "@/domain/tasks";
import { admin, dbTestsEnabled, localDb } from "@/test/local-pg";

// A API de integração de ponta a ponta (rotas de verdade, Postgres local): chave, criação,
// atualização, idempotência e a regra de nunca reabrir tarefa concluída. npm run test:db.

vi.mock("@/infrastructure/db/client", () => ({ createDb: () => localDb }));
const upsertRoute = await import("./tasks/upsert/route");
const listRoute = await import("./tasks/route");

const KEY = "test-key-".repeat(8); // só para este teste, nunca uma chave real
const BASE = "http://localhost:3000/api/integrations/tasks";

const today = () => todayIn("America/Sao_Paulo", new Date());
const at = (days: number, time: string) => `${addDays(today(), days)}T${time}:00-03:00`;

function post(body: unknown, auth: string | null = `Bearer ${KEY}`) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (auth !== null) headers.authorization = auth;
    const request = new NextRequest(`${BASE}/upsert`, {
        method: "POST",
        headers,
        body: typeof body === "string" ? body : JSON.stringify(body),
    });
    return upsertRoute.POST(request);
}

function get(query: string, auth: string | null = `Bearer ${KEY}`) {
    const headers: Record<string, string> = auth === null ? {} : { authorization: auth };
    return listRoute.GET(new NextRequest(`${BASE}${query}`, { headers }));
}

const task = (extra: object = {}) => ({
    externalSource: "n8n",
    externalId: "evt-1",
    title: "Reunião",
    dueAt: at(1, "10:00"),
    ...extra,
});

const row = (id: number) =>
    JSON.parse(
        admin(`select row_to_json(t)::text from (select text, to_char(date, 'YYYY-MM-DD') as date,
            time, note, url, external_source, external_id from tasks where id = ${id}) t`),
    );
const done = (id: number) =>
    admin(`select coalesce(string_agg(to_char(date, 'YYYY-MM-DD'), ','), '')
        from task_completions where task_id = ${id}`);

describe.runIf(dbTestsEnabled)("API de integração (Postgres de verdade)", () => {
    let alice: number;
    let bob: number;

    beforeEach(() => {
        vi.stubEnv("INTEGRATION_API_KEY", KEY);
        vi.stubEnv("INTEGRATION_USER_EMAIL", "Alice@X.com");
        admin("truncate users, user_sessions, tasks, task_completions restart identity cascade");
        alice = Number(
            admin("insert into users (google_sub, email) values ('a', 'alice@x.com') returning id"),
        );
        bob = Number(
            admin("insert into users (google_sub, email) values ('b', 'bob@x.com') returning id"),
        );
    });

    describe("autenticação", () => {
        it("sem as variáveis, as rotas não existem (404)", async () => {
            vi.stubEnv("INTEGRATION_API_KEY", "");
            expect((await post(task())).status).toBe(404);
            expect((await get(`?date=${today()}`)).status).toBe(404);
            vi.stubEnv("INTEGRATION_API_KEY", KEY);
            vi.stubEnv("INTEGRATION_USER_EMAIL", "");
            expect((await post(task())).status).toBe(404);
        });

        it("chave ausente ou errada: 401 sem corpo e nada gravado", async () => {
            for (const auth of [null, "", KEY, `Bearer ${KEY}x`, `Bearer ${"0".repeat(72)}`]) {
                const response = await post(task(), auth);
                expect(response.status, String(auth)).toBe(401);
                expect(await response.text()).toBe("");
                expect((await get(`?date=${today()}`, auth)).status).toBe(401);
            }
            expect(admin("select count(*) from tasks")).toBe("0");
        });

        it("outros métodos dão 404", async () => {
            expect((await upsertRoute.GET()).status).toBe(404);
            expect((await listRoute.POST()).status).toBe(404);
        });

        it("e-mail sem conta: erro genérico, sem detalhe", async () => {
            vi.stubEnv("INTEGRATION_USER_EMAIL", "ninguem@x.com");
            const response = await post(task());
            expect(response.status).toBe(500);
            expect(await response.json()).toEqual({ error: "unavailable" });
        });
    });

    describe("upsert", () => {
        it("cria na conta do dono, com data e hora no fuso dele", async () => {
            const response = await post(
                task({ notes: "sala 2", url: "https://example.com/e/1", dueAt: at(1, "10:00") }),
            );
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body).toEqual({ id: expect.any(Number), action: "created" });
            expect(row(body.id)).toEqual({
                text: "Reunião",
                date: addDays(today(), 1),
                time: "10:00",
                note: "sala 2",
                url: "https://example.com/e/1",
                external_source: "n8n",
                external_id: "evt-1",
            });
            expect(admin(`select user_id from tasks where id = ${body.id}`)).toBe(String(alice));
        });

        it("dueAt em UTC vira a hora de São Paulo; sem dueAt, hoje e sem hora", async () => {
            const utc = `${addDays(today(), 2)}T15:30:00Z`;
            const { id } = await (await post(task({ dueAt: utc }))).json();
            expect(row(id)).toMatchObject({ date: addDays(today(), 2), time: "12:30" });
            const { id: id2 } = await (
                await post({ externalSource: "n8n", externalId: "x", title: "Sem data" })
            ).json();
            expect(row(id2)).toMatchObject({ date: today(), time: null });
        });

        it("idempotente: o mesmo corpo não muda nada; algo diferente atualiza", async () => {
            const { id } = await (await post(task())).json();
            expect(await (await post(task())).json()).toEqual({ id, action: "unchanged" });
            expect(await (await post(task({ title: "Reunião nova" }))).json()).toEqual({
                id,
                action: "updated",
            });
            expect(await (await post(task({ title: "Reunião nova" }))).json()).toEqual({
                id,
                action: "unchanged",
            });
            expect(admin("select count(*) from tasks")).toBe("1");
            expect(row(id).text).toBe("Reunião nova");
        });

        it("tarefa concluída nunca reabre, nem mudando de dia", async () => {
            const { id } = await (await post(task())).json();
            const tomorrow = addDays(today(), 1);
            admin(`insert into task_completions (task_id, date) values (${id}, '${tomorrow}')`);

            expect((await (await post(task({ title: "Mudou" }))).json()).action).toBe("updated");
            expect(done(id)).toBe(tomorrow);

            const moved = await (await post(task({ dueAt: at(3, "09:00") }))).json();
            expect(moved.action).toBe("updated");
            expect(row(id)).toMatchObject({ date: addDays(today(), 3), time: "09:00" });
            expect(done(id)).toBe(addDays(today(), 3));
            const pending = await (await get(`?date=${addDays(today(), 3)}`)).json();
            expect(pending).toEqual([]);
        });

        it("tarefa removida pelo dono não volta", async () => {
            const { id } = await (await post(task())).json();
            admin(`update tasks set deleted_at = now() where id = ${id}`);
            expect(await (await post(task({ title: "de novo" }))).json()).toEqual({
                id,
                action: "unchanged",
            });
            expect(admin(`select deleted_at is not null from tasks where id = ${id}`)).toBe("t");
            expect(row(id).text).toBe("Reunião");
        });

        it("a mesma chave em outra conta é outra tarefa e não é tocada", async () => {
            admin(`insert into tasks (user_id, text, date, position, external_source, external_id)
                values (${bob}, 'do bob', current_date, 1, 'n8n', 'evt-1')`);
            const { id, action } = await (await post(task())).json();
            expect(action).toBe("created");
            expect(admin(`select user_id from tasks where id = ${id}`)).toBe(String(alice));
            expect(admin(`select text from tasks where user_id = ${bob}`)).toBe("do bob");
        });

        it("o banco recusa a mesma chave duas vezes na mesma conta", () => {
            const insert = () =>
                admin(`insert into tasks (user_id, text, date, position, external_source, external_id)
                    values (${alice}, 'x', current_date, 1, 'n8n', 'dup')`);
            insert();
            expect(insert).toThrow();
        });

        it("corpo inválido, chave desconhecida ou dia passado: 400 genérico", async () => {
            for (const body of [
                "não é json",
                "",
                task({ extra: true }),
                task({ title: "" }),
                task({ dueAt: "amanhã" }),
                task({ dueAt: at(-1, "10:00") }),
                { ...task(), notes: "x".repeat(20_000) },
            ]) {
                const response = await post(body);
                expect(response.status).toBe(400);
                expect(await response.json()).toEqual({ error: "invalid" });
            }
            expect(admin("select count(*) from tasks")).toBe("0");
        });
    });

    describe("pendentes do dia", () => {
        it("lista só as pendentes do dono naquele dia", async () => {
            const d = addDays(today(), 1);
            const { id } = await (await post(task({ dueAt: at(1, "10:00") }))).json();
            const { id: feita } = await (
                await post(task({ externalId: "evt-2", title: "Feita" }))
            ).json();
            admin(`insert into task_completions (task_id, date) values (${feita}, '${d}')`);
            await post(task({ externalId: "evt-3", dueAt: at(2, "10:00") })); // outro dia
            admin(`insert into tasks (user_id, text, date, position)
                values (${bob}, 'do bob', '${d}', 1)`);
            const manual = Number(
                admin(`insert into tasks (user_id, text, date, position)
                    values (${alice}, 'à mão', '${d}', 1) returning id`),
            );

            const response = await get(`?date=${d}`);
            expect(response.status).toBe(200);
            expect(await response.json()).toEqual([
                {
                    id,
                    title: "Reunião",
                    dueAt: `${d}T13:00:00Z`,
                    done: false,
                    externalSource: "n8n",
                },
                { id: manual, title: "à mão", dueAt: null, done: false, externalSource: null },
            ]);
        });

        it("data inválida, ausente, repetida ou parâmetro a mais: 400", async () => {
            const d = today();
            for (const query of [
                "",
                "?date=2026-02-30",
                `?date=${d}&date=${d}`,
                `?date=${d}&x=1`,
            ]) {
                expect((await get(query)).status, query).toBe(400);
            }
        });
    });
});
