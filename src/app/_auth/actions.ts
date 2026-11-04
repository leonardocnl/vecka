"use server";

import { redirect } from "next/navigation";
import { authRepository, clearSessionCookie, sessionTokenHash } from "./session";

/** Sair: apaga a sessão no banco primeiro, depois o cookie (security.md §13). Sem entrada. */
export async function signOut(): Promise<void> {
    const tokenHash = await sessionTokenHash();
    if (tokenHash) await authRepository().signOut(tokenHash);
    await clearSessionCookie();
    redirect("/entrar");
}
