import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SessionUser } from "@/application/auth";
import { SESSION_ABSOLUTE_DAYS, SESSION_COOKIE } from "@/domain/auth";
import { hashSessionToken, isSessionToken } from "@/infrastructure/auth/session-token";
import { createDb } from "@/infrastructure/db/client";
import { DrizzleAuthRepository } from "@/infrastructure/db/auth-repository";

export const authRepository = () => new DrizzleAuthRepository(createDb());

export const secureCookie = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
};

/** O hash do cookie de sessão, ou null se falta ou não tem o formato. Não consulta o banco. */
export async function sessionTokenHash(): Promise<string | null> {
    const value = (await cookies()).get(SESSION_COOKIE)?.value;
    return isSessionToken(value) ? hashSessionToken(value) : null;
}

/** A conta da sessão viva, conferida no banco (renova a inatividade). */
export async function currentUser(): Promise<SessionUser | null> {
    const tokenHash = await sessionTokenHash();
    return tokenHash ? authRepository().sessionUser(tokenHash) : null;
}

/** Para páginas e ações: sem sessão viva, vai para /entrar. */
export async function requireUser(): Promise<SessionUser> {
    const user = await currentUser();
    if (!user) redirect("/entrar");
    return user;
}

/** __Host-, HttpOnly, Secure, Lax, Path=/; o cookie vive até o teto absoluto da sessão. */
export async function setSessionCookie(token: string) {
    (await cookies()).set(SESSION_COOKIE, token, {
        ...secureCookie,
        maxAge: SESSION_ABSOLUTE_DAYS * 24 * 60 * 60,
    });
}

export async function clearSessionCookie() {
    (await cookies()).set(SESSION_COOKIE, "", { ...secureCookie, maxAge: 0 });
}
