import "server-only";
import type { AuthRepository, GoogleIdentity, SessionUser } from "@/application/auth";
import * as q from "./auth-sql";

// Basta o execute: o Db do Neon em produção, ou o Postgres local nos testes de ataque.
export type Executor = {
    execute(statement: ReturnType<typeof q.deleteSession>): Promise<{ rows: unknown[] }>;
};

export class DrizzleAuthRepository implements AuthRepository {
    constructor(private readonly db: Executor) {}

    private async rows<T>(statement: ReturnType<typeof q.deleteSession>): Promise<T[]> {
        return (await this.db.execute(statement)).rows as T[];
    }

    async signIn(identity: GoogleIdentity, tokenHash: string) {
        const [user] = await this.rows<{ id: number }>(
            q.upsertUser({ googleSub: identity.sub, email: identity.email, name: identity.name }),
        );
        if (!user) throw new Error("upsert de users sem retorno");
        await this.db.execute(q.purgeExpiredSessions(user.id));
        await this.db.execute(q.createSession(user.id, tokenHash));
    }

    async sessionUser(tokenHash: string): Promise<SessionUser | null> {
        const [row] = await this.rows<SessionUser & { stale: boolean }>(q.sessionUser(tokenHash));
        if (!row) return null;
        if (row.stale) await this.db.execute(q.renewSession(tokenHash));
        return { id: row.id, email: row.email, name: row.name, timeZone: row.timeZone };
    }

    async signOut(tokenHash: string) {
        await this.db.execute(q.deleteSession(tokenHash));
    }
}
