import type { NextRequest } from "next/server";
import { upsertExternalTask } from "@/application/integrations";
import { integration, invalid, json, notFound } from "../../handler";
import { BODY_MAX_BYTES, schemas } from "../../schemas";

// Cria ou atualiza uma tarefa pela chave (externalSource, externalId). docs/integracoes.md
export async function POST(request: NextRequest) {
    return integration(request, async (repo, owner) => {
        const raw = await request.text();
        if (raw.length > BODY_MAX_BYTES) return invalid();
        let body: unknown;
        try {
            body = JSON.parse(raw);
        } catch {
            return invalid();
        }
        const parsed = schemas.upsert.safeParse(body);
        if (!parsed.success) return invalid();
        const result = await upsertExternalTask(repo, owner, new Date(), parsed.data);
        return result ? json(result) : invalid();
    });
}

// security.md §3: métodos não suportados respondem 404
export { notFound as GET, notFound as PUT, notFound as PATCH, notFound as DELETE };
