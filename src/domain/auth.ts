// Regras puras do login (security.md §13). Sem framework e sem I/O.

export const SESSION_COOKIE = "__Host-vecka_session";
// state, code_verifier e nonce do OAuth, presos ao navegador que começou o login
export const OAUTH_COOKIE = "__Host-vecka_oauth";
export const OAUTH_TTL_SECONDS = 10 * 60;

// expiração por inatividade (renovada no uso) e teto absoluto, como no Kinne
export const SESSION_SLIDING_DAYS = 30;
export const SESSION_ABSOLUTE_DAYS = 90;
// a sessão renova no máximo uma vez por hora: ler não escreve a cada pedido
export const SESSION_RENEW_AFTER_MINUTES = 60;

/** E-mail normalizado para comparar: sem espaços nas pontas e em minúsculas. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** ALLOWED_EMAILS ("a@x.com, b@y.com") como conjunto. Vazio = ninguém entra (falha fechada). */
export function parseAllowedEmails(raw: string | undefined): ReadonlySet<string> {
    return new Set(
        (raw ?? "")
            .split(",")
            .map(normalizeEmail)
            .filter((email) => email.includes("@")),
    );
}

export const isAllowedEmail = (email: string, allowed: ReadonlySet<string>): boolean =>
    allowed.has(normalizeEmail(email));
