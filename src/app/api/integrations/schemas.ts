import { z } from "zod";
import { isValidDate, NOTE_MAX, TEXT_MAX } from "@/domain/tasks";

// Entrada estrita da API de integração (security.md §5): tamanhos, formatos, chaves desconhecidas
// recusadas.

export const BODY_MAX_BYTES = 16_384;
const optionalText = (max: number) =>
    z
        .string()
        .trim()
        .max(max)
        .nullish()
        .transform((v) => v || null);

export const schemas = {
    upsert: z.strictObject({
        externalSource: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/),
        externalId: z.string().min(1).max(255),
        title: z.string().trim().min(1).max(TEXT_MAX),
        // com fuso obrigatório: "Z" ou "-03:00"
        dueAt: z.iso.datetime({ offset: true }).optional(),
        notes: optionalText(NOTE_MAX),
        url: z
            .url({ protocol: /^https?$/ })
            .max(2048)
            .nullish()
            .transform((v) => v ?? null),
    }),
    pending: z.strictObject({ date: z.string().refine(isValidDate) }),
};
