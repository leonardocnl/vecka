import { appliesOn, swapPositions, type Task } from "@/domain/tasks";

// Casos de uso das tarefas. O userId e o "hoje" vêm sempre da sessão (o fuso é o do usuário);
// o servidor reconfere toda regra que a tela aplica: dia passado é só leitura, e a tarefa precisa
// existir, ser do usuário e valer no dia pedido.

export type TaskInput = {
    text: string;
    date: string | null;
    days: number[] | null;
    time: string | null;
};

export interface TasksRepository {
    list(userId: number, today: string): Promise<Task[]>;
    get(userId: number, id: number): Promise<Task | null>;
    add(userId: number, input: TaskInput): Promise<number>;
    update(
        userId: number,
        id: number,
        input: TaskInput & { note: string | null },
    ): Promise<boolean>;
    setPosition(userId: number, id: number, position: number): Promise<boolean>;
    remove(userId: number, id: number): Promise<boolean>;
    setDone(userId: number, id: number, date: string, done: boolean): Promise<void>;
}

export type Ctx = { repo: TasksRepository; userId: number; today: string };

/** Uma tarefa avulsa de dia passado não muda mais (fase 3: só consulta). */
const editable = (task: Task, today: string) => task.date === null || task.date >= today;

export async function addTask(
    { repo, userId, today }: Ctx,
    input: { text: string; date: string; days: number[] | null; time: string | null },
): Promise<number | null> {
    if (input.date < today) return null;
    const days = input.days && input.days.length > 0 ? input.days : null;
    return repo.add(userId, { ...input, days, date: days ? null : input.date });
}

export async function setDone(
    { repo, userId, today }: Ctx,
    input: { id: number; date: string; done: boolean },
): Promise<boolean> {
    if (input.date < today) return false;
    const task = await repo.get(userId, input.id);
    if (!task || !appliesOn(task, input.date)) return false;
    await repo.setDone(userId, input.id, input.date, input.done);
    return true;
}

export async function updateTask(
    { repo, userId, today }: Ctx,
    input: {
        id: number;
        text: string;
        time: string | null;
        note: string | null;
        days: number[] | null;
        /** o dia aberto: vira a data se a tarefa deixa de ser recorrente */
        date: string;
    },
): Promise<boolean> {
    const task = await repo.get(userId, input.id);
    if (!task || !editable(task, today)) return false;
    const days = input.days && input.days.length > 0 ? input.days : null;
    const date = days ? null : (task.date ?? input.date);
    if (date !== null && date < today) return false;
    return repo.update(userId, input.id, {
        text: input.text,
        time: input.time,
        note: input.note,
        days,
        date,
    });
}

/** Sobe (-1) ou desce (1) entre as sem horário do dia; a troca é calculada aqui, não no cliente. */
export async function moveTask(
    { repo, userId, today }: Ctx,
    input: { id: number; date: string; dir: -1 | 1 },
): Promise<boolean> {
    if (input.date < today) return false;
    const swap = swapPositions(await repo.list(userId, today), input.date, input.id, input.dir);
    if (!swap) return false;
    for (const { id, position } of swap) await repo.setPosition(userId, id, position);
    return true;
}

export async function removeTask(
    { repo, userId, today }: Ctx,
    input: { id: number },
): Promise<boolean> {
    const task = await repo.get(userId, input.id);
    if (!task || !editable(task, today)) return false;
    return repo.remove(userId, input.id);
}
