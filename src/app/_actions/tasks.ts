"use server";

import "server-only";
import type { z } from "zod";
import * as uc from "@/application/tasks";
import { HH_MM, isValidDate, NOTE_MAX, TEXT_MAX, todayIn, type Task } from "@/domain/tasks";
import { MemoryLimiter } from "@/infrastructure/memory-limiter";
import { createDb } from "@/infrastructure/db/client";
import { DrizzleTasksRepository } from "@/infrastructure/db/tasks-repository";
import { currentUser } from "@/app/_auth/session";
import { schemas } from "./task-schemas";

// Toda server action é um endpoint público (security.md §5): entrada com zod estrito (chaves
// desconhecidas recusadas), usuário e "hoje" só da sessão, erro sempre genérico para a tela.

export type Result<T = undefined> = { ok: true; value: T } | { ok: false };
const fail = { ok: false } as const;

// 120 escritas de folga e 2 por segundo, por usuário
const limiter = new MemoryLimiter(
    () => 120,
    () => 2,
);

async function context(write: boolean): Promise<uc.Ctx | null> {
    const user = await currentUser();
    if (!user) return null;
    if (write && !limiter.take(`tasks:${user.id}`)) return null;
    return {
        repo: new DrizzleTasksRepository(createDb()),
        userId: user.id,
        today: todayIn(user.timeZone, new Date()),
    };
}

async function run<S extends z.ZodType, T>(
    schema: S,
    input: unknown,
    fn: (ctx: uc.Ctx, data: z.output<S>) => Promise<T | null | false>,
): Promise<Result<T>> {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return fail;
    try {
        const ctx = await context(true);
        if (!ctx) return fail;
        const value = await fn(ctx, parsed.data);
        return value === null || value === false ? fail : { ok: true, value: value as T };
    } catch (error) {
        console.error("tarefas: falha ao gravar", (error as Error).name);
        return fail;
    }
}

export type Week = { today: string; timeZone: string; tasks: Task[] };

/** Recarrega a lista (ao voltar ao app e depois de um erro). Sem entrada. */
export async function loadWeek(): Promise<Result<Week>> {
    try {
        const user = await currentUser();
        if (!user) return fail;
        const today = todayIn(user.timeZone, new Date());
        const tasks = await new DrizzleTasksRepository(createDb()).list(user.id, today);
        return { ok: true, value: { today, timeZone: user.timeZone, tasks } };
    } catch (error) {
        console.error("tarefas: falha ao ler", (error as Error).name);
        return fail;
    }
}

export async function addTask(input: unknown): Promise<Result<number>> {
    return run(schemas.add, input, (ctx, data) => uc.addTask(ctx, data));
}

export async function setDone(input: unknown): Promise<Result<true>> {
    return run(schemas.setDone, input, (ctx, data) => uc.setDone(ctx, data));
}

export async function updateTask(input: unknown): Promise<Result<true>> {
    return run(schemas.update, input, (ctx, data) => uc.updateTask(ctx, data));
}

export async function moveTask(input: unknown): Promise<Result<true>> {
    return run(schemas.move, input, (ctx, data) => uc.moveTask(ctx, data));
}

export async function removeTask(input: unknown): Promise<Result<true>> {
    return run(schemas.remove, input, (ctx, data) => uc.removeTask(ctx, data));
}
