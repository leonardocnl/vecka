import { beforeEach, describe, expect, it } from "vitest";
import * as uc from "@/application/tasks";
import { admin, dbTestsEnabled, localDb } from "@/test/local-pg";
import { DrizzleTasksRepository } from "./tasks-repository";

// Testes de ataque das tarefas contra um Postgres de verdade (job auth-db): tarefa de outro
// usuário se comporta como inexistente em toda leitura e escrita.

const repo = new DrizzleTasksRepository(localDb);
let today = "";
const ctx = (userId: number): uc.Ctx => ({ repo, userId, today });
const dump = () => admin("select row_to_json(t)::text from (select * from tasks order by id) t");
const doneRows = () => Number(admin("select count(*) from task_completions"));

describe.runIf(dbTestsEnabled)("tarefas: isolamento por usuário (Postgres de verdade)", () => {
    let alice: number;
    let bob: number;
    let task: number;

    beforeEach(async () => {
        today = admin("select to_char(current_date, 'YYYY-MM-DD')");
        admin("truncate users, user_sessions, tasks, task_completions restart identity cascade");
        alice = Number(
            admin("insert into users (google_sub, email) values ('a', 'a@x.com') returning id"),
        );
        bob = Number(
            admin("insert into users (google_sub, email) values ('b', 'b@x.com') returning id"),
        );
        task = (await uc.addTask(ctx(alice), {
            text: "segredo da alice",
            date: today,
            days: null,
            time: null,
        }))!;
        await uc.addTask(ctx(alice), { text: "outra", date: today, days: null, time: null });
    });

    it("bob não lê a tarefa da alice", async () => {
        expect(await repo.list(bob, today)).toEqual([]);
        expect(await repo.get(bob, task)).toBeNull();
        expect((await repo.list(alice, today)).map((t) => t.text)).toContain("segredo da alice");
    });

    it("bob não edita a tarefa da alice", async () => {
        const before = dump();
        const input = { id: task, text: "hack", time: null, note: "x", days: null, date: today };
        expect(await uc.updateTask(ctx(bob), input)).toBe(false);
        expect(await repo.update(bob, task, { ...input, days: null })).toBe(false);
        expect(dump()).toBe(before);
    });

    it("bob não marca nem desmarca a tarefa da alice", async () => {
        expect(await uc.setDone(ctx(bob), { id: task, date: today, done: true })).toBe(false);
        await repo.setDone(bob, task, today, true);
        expect(doneRows()).toBe(0);

        await uc.setDone(ctx(alice), { id: task, date: today, done: true });
        await repo.setDone(bob, task, today, false);
        expect(doneRows()).toBe(1);
    });

    it("bob não move a tarefa da alice", async () => {
        const before = dump();
        expect(await uc.moveTask(ctx(bob), { id: task, date: today, dir: 1 })).toBe(false);
        expect(await repo.setPosition(bob, task, -999)).toBe(false);
        expect(dump()).toBe(before);
    });

    it("bob não remove a tarefa da alice", async () => {
        expect(await uc.removeTask(ctx(bob), { id: task })).toBe(false);
        expect(await repo.remove(bob, task)).toBe(false);
        expect(admin(`select deleted_at is null from tasks where id = ${task}`)).toBe("t");
    });

    it("tarefa removida some e não aceita mais nada", async () => {
        expect(await uc.removeTask(ctx(alice), { id: task })).toBe(true);
        expect((await repo.list(alice, today)).map((t) => t.id)).not.toContain(task);
        expect(await uc.setDone(ctx(alice), { id: task, date: today, done: true })).toBe(false);
        expect(await uc.removeTask(ctx(alice), { id: task })).toBe(false);
        // exclusão lógica: a linha continua lá para o histórico
        expect(admin(`select count(*) from tasks where id = ${task}`)).toBe("1");
    });

    it("dia passado é só leitura", async () => {
        const yesterday = admin("select to_char(current_date - 1, 'YYYY-MM-DD')");
        expect(
            await uc.addTask(ctx(alice), {
                text: "ontem",
                date: yesterday,
                days: null,
                time: null,
            }),
        ).toBeNull();
        expect(await uc.setDone(ctx(alice), { id: task, date: yesterday, done: true })).toBe(false);
        admin(`update tasks set date = current_date - 1 where id = ${task}`);
        expect(await uc.removeTask(ctx(alice), { id: task })).toBe(false);
    });

    it("não marca tarefa num dia em que ela não vale", async () => {
        const tomorrow = admin("select to_char(current_date + 1, 'YYYY-MM-DD')");
        expect(await uc.setDone(ctx(alice), { id: task, date: tomorrow, done: true })).toBe(false);
    });

    it("dono faz tudo: marcar, mover, editar para recorrente", async () => {
        expect(await uc.setDone(ctx(alice), { id: task, date: today, done: true })).toBe(true);
        expect((await repo.get(alice, task))?.id).toBe(task);
        expect((await repo.list(alice, today)).find((t) => t.id === task)?.doneDates).toEqual([
            today,
        ]);
        const ok = await uc.updateTask(ctx(alice), {
            id: task,
            text: "toda segunda",
            time: "08:15",
            note: "nota",
            days: [1],
            date: today,
        });
        expect(ok).toBe(true);
        expect(await repo.get(alice, task)).toMatchObject({
            text: "toda segunda",
            date: null,
            recurringDays: [1],
            time: "08:15",
            note: "nota",
        });
    });

    it("o banco recusa avulsa e recorrente ao mesmo tempo, dia 7 e horário inválido", () => {
        const insert = (cols: string) =>
            admin(`insert into tasks (user_id, text, position, ${cols})`);
        expect(() =>
            insert(`date, recurring_days) values (${alice}, 'x', 1, current_date, '{1}'`),
        ).toThrow();
        expect(() => insert(`recurring_days) values (${alice}, 'x', 1, '{7}'`)).toThrow();
        expect(() =>
            insert(`date, time) values (${alice}, 'x', 1, current_date, '25:00'`),
        ).toThrow();
    });

    describe("histórico", () => {
        const d = (n: number) => admin(`select to_char(current_date + ${n}, 'YYYY-MM-DD')`);
        let from = "";
        let to = "";

        beforeEach(() => {
            from = d(-20);
            to = d(-1);
            // avulsa de 3 dias atrás, feita; avulsa de 5 dias atrás, removida
            admin(`update tasks set date = current_date - 3 where id = ${task}`);
            admin(
                `insert into task_completions (task_id, date) values (${task}, current_date - 3)`,
            );
            admin(`insert into tasks (user_id, text, date, position, deleted_at)
                values (${alice}, 'removida', current_date - 5, 1, now())`);
            // recorrente de todos os dias, criada há 10 dias
            admin(`insert into tasks (user_id, text, recurring_days, position, created_at)
                values (${alice}, 'diária', '{0,1,2,3,4,5,6}', 1, now() - interval '10 days')`);
        });

        it("bob não lê o histórico da alice", async () => {
            expect(await repo.history(bob, from, to)).toEqual([]);
            expect(await repo.history(bob, d(-60), d(60))).toEqual([]);
        });

        it("alice lê as avulsas do intervalo, as recorrentes e as conclusões; removidas não", async () => {
            const list = await repo.history(alice, from, to);
            const texts = list.map((t) => t.text);
            expect(texts).toContain("segredo da alice");
            expect(texts).toContain("diária");
            expect(texts).not.toContain("removida");
            expect(texts).not.toContain("outra"); // é de hoje, fora do intervalo
            expect(list.find((t) => t.id === task)?.doneDates).toEqual([d(-3)]);
            expect(list.find((t) => t.text === "diária")?.createdOn).toBe(
                admin(
                    "select to_char((now() - interval '10 days') at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')",
                ),
            );
        });

        it("recorrente criada depois do intervalo não aparece nele", async () => {
            expect((await repo.history(alice, d(-30), d(-15))).map((t) => t.text)).toEqual([]);
        });

        it("dia de criação da conta, só da própria conta", async () => {
            expect(await repo.since(alice)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(await repo.since(999_999)).toBeNull();
        });

        it("o histórico continua só leitura no servidor", async () => {
            const before = dump();
            const old = d(-3);
            expect(await uc.setDone(ctx(alice), { id: task, date: old, done: false })).toBe(false);
            expect(await uc.removeTask(ctx(alice), { id: task })).toBe(false);
            const edit = { id: task, text: "mudou", time: null, note: null, days: null, date: old };
            expect(await uc.updateTask(ctx(alice), edit)).toBe(false);
            expect(await uc.moveTask(ctx(alice), { id: task, date: old, dir: 1 })).toBe(false);
            expect(dump()).toBe(before);
            expect(doneRows()).toBe(1);
        });
    });
});
