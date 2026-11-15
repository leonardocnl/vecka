import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

// Chave da API de integração (docs/integracoes.md). Lida a cada pedido; faltando qualquer uma das
// variáveis, ou com chave curta demais, a API não existe (404). A chave nunca vai para log.

export const INTEGRATION_KEY_MIN = 32;

export type IntegrationConfig = { key: string; email: string };

export function integrationConfig(
    env: Record<string, string | undefined> = process.env,
): IntegrationConfig | null {
    const key = env.INTEGRATION_API_KEY?.trim() ?? "";
    const email = env.INTEGRATION_USER_EMAIL?.trim() ?? "";
    if (key.length < INTEGRATION_KEY_MIN || !email) return null;
    return { key, email };
}

const digest = (value: string) => createHash("sha256").update(value).digest();

/** "Bearer <chave>", comparado em tempo constante (os dois lados viram SHA-256 de mesmo tamanho). */
export function hasIntegrationKey(header: string | null, key: string): boolean {
    const match = /^Bearer (\S+)$/.exec(header ?? "");
    return !!match && timingSafeEqual(digest(match[1]!), digest(key));
}
