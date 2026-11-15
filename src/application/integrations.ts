import { clockIn, todayIn } from "@/domain/tasks";

// API de integração (docs/integracoes.md): uma automação cria e atualiza tarefas do dono pela
// chave (source, id) dela. Regras: a integração só cria avulsas; dia passado continua só leitura;
// tarefa concluída nunca é reaberta; tarefa removida pelo dono não volta.

export type Owner = { id: number; timeZone: string };

export type ExternalTask = {
    source: string;
    externalId: string;
    text: string;
    date: string;
    time: string | null;
    note: string | null;
    url: string | null;
};

export type PendingTask = {
    id: number;
    title: string;
    dueAt: string | null;
    done: boolean;
    externalSource: string | null;
};

export interface IntegrationRepository {
    ownerByEmail(email: string): Promise<Owner | null>;
    findExternal(
        userId: number,
        source: string,
        externalId: string,
    ): Promise<{ id: number; date: string | null; deleted: boolean } | null>;
    /** null = outra chamada criou a mesma chave antes */
    insertExternal(userId: number, task: ExternalTask): Promise<number | null>;
    /** false = nada mudou */
    updateExternal(userId: number, id: number, task: ExternalTask): Promise<boolean>;
    moveCompletion(userId: number, id: number, from: string, to: string): Promise<void>;
    pendingOn(userId: number, date: string): Promise<PendingTask[]>;
}

export type UpsertInput = {
    externalSource: string;
    externalId: string;
    title: string;
    dueAt?: string;
    notes?: string | null;
    url?: string | null;
};

export type UpsertResult = { id: number; action: "created" | "updated" | "unchanged" };

/** null = dueAt cai num dia que já passou (só leitura). */
export async function upsertExternalTask(
    repo: IntegrationRepository,
    owner: Owner,
    now: Date,
    input: UpsertInput,
): Promise<UpsertResult | null> {
    const today = todayIn(owner.timeZone, now);
    const due = input.dueAt ? new Date(input.dueAt) : null;
    const dueDate = due ? todayIn(owner.timeZone, due) : null;
    if (dueDate !== null && dueDate < today) return null;

    const key = [owner.id, input.externalSource, input.externalId] as const;
    const fields = (date: string): ExternalTask => ({
        source: input.externalSource,
        externalId: input.externalId,
        text: input.title,
        date,
        time: due ? clockIn(owner.timeZone, due) : null,
        note: input.notes ?? null,
        url: input.url ?? null,
    });

    let found = await repo.findExternal(...key);
    if (!found) {
        const id = await repo.insertExternal(owner.id, fields(dueDate ?? today));
        if (id !== null) return { id, action: "created" };
        found = await repo.findExternal(...key);
        if (!found) throw new Error("integração: chave sumiu depois do conflito");
    }
    // removida pelo dono, ou já no histórico: fica como está
    if (found.deleted || (found.date !== null && found.date < today)) {
        return { id: found.id, action: "unchanged" };
    }

    // sem dueAt, a tarefa fica no dia em que já está (recorrente vira avulsa de hoje)
    const task = fields(dueDate ?? found.date ?? today);
    // ponytail: dois comandos sem transação (driver HTTP). A conclusão vai antes: se o segundo
    // falhar, a próxima chamada termina a troca e a tarefa nunca aparece reaberta de vez.
    if (found.date !== null && found.date !== task.date) {
        await repo.moveCompletion(owner.id, found.id, found.date, task.date);
    }
    const changed = await repo.updateExternal(owner.id, found.id, task);
    return { id: found.id, action: changed ? "updated" : "unchanged" };
}
