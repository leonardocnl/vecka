import "server-only";
import type { TaskInput, TasksRepository } from "@/application/tasks";
import type { HistoryTask, Task } from "@/domain/tasks";
import type { Executor } from "./auth-repository";
import * as q from "./tasks-sql";

type Row = Omit<Task, "doneDates" | "position"> & {
    position: number | string;
    doneDates?: unknown;
};

// O driver HTTP devolve json já como objeto; por garantia, aceita o texto também.
const json = <T>(value: unknown): T => (typeof value === "string" ? JSON.parse(value) : value) as T;

const toTask = (row: Row): Task => ({
    id: Number(row.id),
    text: row.text,
    date: row.date,
    recurringDays: json<number[] | null>(row.recurringDays),
    time: row.time,
    note: row.note,
    position: Number(row.position),
    doneDates: json<string[]>(row.doneDates ?? []),
});

export class DrizzleTasksRepository implements TasksRepository {
    constructor(private readonly db: Executor) {}

    private async rows<T>(statement: Parameters<Executor["execute"]>[0]): Promise<T[]> {
        return (await this.db.execute(statement)).rows as T[];
    }

    async list(userId: number, today: string) {
        return (await this.rows<Row>(q.listTasks(userId, today))).map(toTask);
    }

    async history(userId: number, from: string, to: string): Promise<HistoryTask[]> {
        const rows = await this.rows<Row & { createdOn: string }>(q.listHistory(userId, from, to));
        return rows.map((row) => ({ ...toTask(row), createdOn: row.createdOn }));
    }

    async since(userId: number): Promise<string | null> {
        const [row] = await this.rows<{ since: string }>(q.accountSince(userId));
        return row?.since ?? null;
    }

    async get(userId: number, id: number) {
        const [row] = await this.rows<Row>(q.getTask(userId, id));
        return row ? toTask(row) : null;
    }

    async add(userId: number, input: TaskInput) {
        const [row] = await this.rows<{ id: number }>(q.insertTask(userId, input));
        return Number(row!.id);
    }

    async update(userId: number, id: number, input: TaskInput & { note: string | null }) {
        return (await this.rows(q.updateTask(userId, id, input))).length === 1;
    }

    async setPosition(userId: number, id: number, position: number) {
        return (await this.rows(q.setPosition(userId, id, position))).length === 1;
    }

    async remove(userId: number, id: number) {
        return (await this.rows(q.softDeleteTask(userId, id))).length === 1;
    }

    async setDone(userId: number, id: number, date: string, done: boolean) {
        await this.db.execute(done ? q.markDone(userId, id, date) : q.markUndone(userId, id, date));
    }
}
