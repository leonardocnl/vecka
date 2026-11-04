import "server-only";
import { parseAllowedEmails } from "@/domain/auth";

// Configuração do login, lida a cada pedido. Falta algo = login desligado (falha fechada); o erro
// nomeia a variável, nunca o valor (security.md §4).

export type GoogleConfig = {
    clientId: string;
    clientSecret: string;
    allowedEmails: ReadonlySet<string>;
};

export function googleConfig(env: Record<string, string | undefined> = process.env): GoogleConfig {
    const clientId = env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
    const allowedEmails = parseAllowedEmails(env.ALLOWED_EMAILS);
    if (!clientId) throw new Error("GOOGLE_CLIENT_ID não definida");
    if (!clientSecret) throw new Error("GOOGLE_CLIENT_SECRET não definida");
    if (allowedEmails.size === 0) throw new Error("ALLOWED_EMAILS vazia");
    return { clientId, clientSecret, allowedEmails };
}
