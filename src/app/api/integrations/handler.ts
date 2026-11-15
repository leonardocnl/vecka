import "server-only";
import type { NextRequest } from "next/server";
import type { Owner } from "@/application/integrations";
import { hasIntegrationKey, integrationConfig } from "@/infrastructure/auth/integration";
import { createDb } from "@/infrastructure/db/client";
import { DrizzleTasksRepository } from "@/infrastructure/db/tasks-repository";
import { MemoryLimiter } from "@/infrastructure/memory-limiter";

// O que as duas rotas da integração têm em comum: desligada = 404; chave errada = 401 sem
// corpo; limite de pedidos; o dono vem de INTEGRATION_USER_EMAIL. Erro sempre genérico.

// 120 pedidos de folga e 2 por segundo, para a integração toda
const limiter = new MemoryLimiter(
    () => 120,
    () => 2,
);

const headers = { "Cache-Control": "no-store" };
const empty = (status: number) => new Response(null, { status, headers });
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
export const invalid = () => json({ error: "invalid" }, 400);
export const notFound = () => empty(404);

export async function integration(
    request: NextRequest,
    fn: (repo: DrizzleTasksRepository, owner: Owner) => Promise<Response>,
): Promise<Response> {
    const config = integrationConfig();
    if (!config) return notFound();
    if (!hasIntegrationKey(request.headers.get("authorization"), config.key)) return empty(401);
    // depois da chave: quem não a tem não esgota o limite da automação
    if (!limiter.take("integration")) return empty(429);
    try {
        const repo = new DrizzleTasksRepository(createDb());
        const owner = await repo.ownerByEmail(config.email);
        if (!owner) {
            console.error("integração: INTEGRATION_USER_EMAIL não corresponde a uma conta");
            return json({ error: "unavailable" }, 500);
        }
        return await fn(repo, owner);
    } catch (error) {
        console.error("integração: falha", (error as Error).name);
        return json({ error: "unavailable" }, 500);
    }
}
