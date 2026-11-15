import type { NextRequest } from "next/server";
import { integration, invalid, json, notFound } from "../handler";
import { schemas } from "../schemas";

// Pendentes de um dia (?date=AAAA-MM-DD, no fuso do dono). Único query param fora do OAuth:
// security.md §15. docs/integracoes.md
export async function GET(request: NextRequest) {
    return integration(request, async (repo, owner) => {
        const params = request.nextUrl.searchParams;
        if (params.getAll("date").length !== 1) return invalid();
        const parsed = schemas.pending.safeParse(Object.fromEntries(params));
        if (!parsed.success) return invalid();
        return json(await repo.pendingOn(owner.id, parsed.data.date));
    });
}

export { notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
