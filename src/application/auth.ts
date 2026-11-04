import { timingSafeEqual } from "node:crypto";
import { isAllowedEmail } from "@/domain/auth";

// Casos de uso do login com Google (security.md §13). As peças de rede, crypto e banco chegam por
// dependência: a infrastructure as implementa e os testes as trocam por falsas.

export type OAuthAttempt = { state: string; verifier: string; nonce: string };
export type GoogleIdentity = { sub: string; email: string; name: string };
export type SessionUser = { id: number; email: string; name: string };

export interface AuthRepository {
    /** Cria/atualiza a conta pelo sub e abre uma sessão com o hash dado. */
    signIn(identity: GoogleIdentity, tokenHash: string): Promise<void>;
    /** A conta da sessão viva (e renova a inatividade); null se não existe ou venceu. */
    sessionUser(tokenHash: string): Promise<SessionUser | null>;
    signOut(tokenHash: string): Promise<void>;
}

export type GoogleSignInDeps = {
    repository: AuthRepository;
    allowedEmails: ReadonlySet<string>;
    /** troca o code pelo id_token (com o code_verifier) */
    exchangeCode(code: string, verifier: string): Promise<string>;
    /** valida assinatura, iss, aud, exp, nonce e email_verified; lança se inválido */
    verifyIdToken(idToken: string, nonce: string): Promise<GoogleIdentity>;
    newSessionToken(): string;
    hashSessionToken(token: string): string;
};

export type GoogleSignInResult =
    | { status: "ok"; sessionToken: string }
    // fora da lista: nada de sessão nem registro no banco
    | { status: "denied" }
    | { status: "invalid"; reason: string };

const sameString = (a: string, b: string) => {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
};

export async function completeGoogleSignIn(
    deps: GoogleSignInDeps,
    input: { code: string | null; state: string | null; attempt: OAuthAttempt | null },
): Promise<GoogleSignInResult> {
    const { code, state, attempt } = input;
    // o cookie do navegador que começou o login é a prova: sem ele, ou com state diferente, para
    if (!attempt) return { status: "invalid", reason: "sem cookie do OAuth" };
    if (!state || !sameString(state, attempt.state)) return { status: "invalid", reason: "state" };
    if (!code || code.length > 2048) return { status: "invalid", reason: "code" };

    const identity = await deps.verifyIdToken(
        await deps.exchangeCode(code, attempt.verifier),
        attempt.nonce,
    );
    if (!isAllowedEmail(identity.email, deps.allowedEmails)) return { status: "denied" };

    const sessionToken = deps.newSessionToken();
    await deps.repository.signIn(identity, deps.hashSessionToken(sessionToken));
    return { status: "ok", sessionToken };
}
