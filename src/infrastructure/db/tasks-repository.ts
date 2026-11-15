import "server-only";
import type {
    ExternalTask,
    IntegrationRepository,
    Owner,
    PendingTask,
} from "@/application/integrations";
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

export class DrizzleTasksRepository implements TasksRepository, IntegrationRepository {
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

    // ---------- integração ----------

    async ownerByEmail(email: string): Promise<Owner | null> {
        const rows = await this.rows<Owner>(q.usersByEmail(email));
        return rows.length === 1 ? { id: Number(rows[0]!.id), timeZone: rows[0]!.timeZone } : null;
    }

    async findExternal(userId: number, source: string, externalId: string) {
        const [row] = await this.rows<{ id: number; date: string | null; deleted: boolean }>(
            q.findExternal(userId, source, externalId),
        );
        return row ? { ...row, id: Number(row.id) } : null;
    }

    async insertExternal(userId: number, task: ExternalTask) {
        const [row] = await this.rows<{ id: number }>(q.insertExternal(userId, task));
        return row ? Number(row.id) : null;
    }

    async updateExternal(userId: number, id: number, task: ExternalTask) {
        return (await this.rows(q.updateExternal(userId, id, task))).length === 1;
    }

    async moveCompletion(userId: number, id: number, from: string, to: string) {
        await this.db.execute(q.moveCompletion(userId, id, from, to));
    }

    async pendingOn(userId: number, date: string): Promise<PendingTask[]> {
        const rows = await this.rows<PendingTask>(q.pendingOn(userId, date));
        return rows.map((row) => ({ ...row, id: Number(row.id) }));
    }
}
