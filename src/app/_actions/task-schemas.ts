import { z } from "zod";
import { daysBetween, HH_MM, isValidDate, NOTE_MAX, TEXT_MAX } from "@/domain/tasks";

// Entrada estrita das ações de tarefas (security.md §5): tamanhos, formatos, chaves desconhecidas
// recusadas.

export const HISTORY_MAX_DAYS = 42;

const id = z.number().int().positive().max(2_147_483_647);
const date = z.string().refine(isValidDate);
const text = z.string().trim().min(1).max(TEXT_MAX);
const time = z.string().regex(HH_MM).nullable();
const days = z
    .array(z.number().int().min(0).max(6))
    .max(7)
    .refine((list) => new Set(list).size === list.length)
    .nullable();

export const schemas = {
    add: z.strictObject({ text, date, days, time }),
    setDone: z.strictObject({ id, date, done: z.boolean() }),
    update: z.strictObject({
        id,
        text,
        time,
        note: z
            .string()
            .trim()
            .max(NOTE_MAX)
            .nullable()
            .transform((v) => v || null),
        days,
        date,
    }),
    move: z.strictObject({ id, date, dir: z.union([z.literal(-1), z.literal(1)]) }),
    remove: z.strictObject({ id }),
    /** o mês visível do calendário: no máximo 42 dias (6 semanas), from ≤ to */
    history: z.strictObject({ from: date, to: date }).refine(({ from, to }) => {
        const span = daysBetween(from, to);
        return span >= 0 && span < HISTORY_MAX_DAYS;
    }),
};
