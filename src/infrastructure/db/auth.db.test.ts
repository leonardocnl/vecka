import { beforeEach, describe, expect, it } from "vitest";
import { hashSessionToken, newSessionToken } from "@/infrastructure/auth/session-token";
import { admin, dbTestsEnabled, localDb } from "@/test/local-pg";
import { DrizzleAuthRepository } from "./auth-repository";

// Testes de ataque das sessões contra um Postgres de verdade (npm run test:db; na CI, job auth-db).
// O relógio é o do banco: "o tempo passa" movendo as datas da sessão para trás.

const repo = new DrizzleAuthRepository(localDb);
const leo = { sub: "google-sub-leo", email: "leo@example.com", name: "Leo" };

async function signIn(identity = leo) {
    const token = newSessionToken();
    const hash = hashSessionToken(token);
    await repo.signIn(identity, hash);
    return { token, hash };
}

const count = (sql: string) => Number(admin(`select count(*) from (${sql}) t`));

describe.runIf(dbTestsEnabled)("sessões (Postgres de verdade)", () => {
    beforeEach(() => {
        admin("truncate users, user_sessions restart identity cascade");
    });

    it("o banco guarda só o hash do token, nunca o token", async () => {
        const { token, hash } = await signIn();
        expect(admin("select token_hash from user_sessions")).toBe(hash);
        expect(count(`select 1 from user_sessions where token_hash = '${token}'`)).toBe(0);
        expect(await repo.sessionUser(hash)).toMatchObject({ email: leo.email, name: leo.name });
    });

    it("o token cru (sem hash) não abre a sessão", async () => {
        const { token } = await signIn();
        expect(await repo.sessionUser(token)).toBeNull();
    });

    it("token inventado ou com SQL não abre nada nem quebra as tabelas", async () => {
        await signIn();
        for (const forged of [
            hashSessionToken(newSessionToken()),
            "0".repeat(64),
            "' or '1'='1",
            "x'; drop table users; --",
        ]) {
            expect(await repo.sessionUser(forged)).toBeNull();
        }
        expect(count("select 1 from users")).toBe(1);
    });

    it("sessão vencida por inatividade não vale", async () => {
        const { hash } = await signIn();
        admin("update user_sessions set expires_at = now() - interval '1 second'");
        expect(await repo.sessionUser(hash)).toBeNull();
    });

    it("sessão além do teto absoluto não vale, mesmo em uso", async () => {
        const { hash } = await signIn();
        admin(
            "update user_sessions set absolute_expires_at = now() - interval '1 second', expires_at = now() - interval '2 seconds', last_used_at = now()",
        );
        expect(await repo.sessionUser(hash)).toBeNull();
    });

    it("renova a inatividade no uso, mas nunca além do teto absoluto", async () => {
        const { hash } = await signIn();
        admin(
            "update user_sessions set last_used_at = now() - interval '2 hours', expires_at = now() + interval '1 hour', absolute_expires_at = now() + interval '5 days'",
        );
        expect(await repo.sessionUser(hash)).not.toBeNull();
        expect(admin("select expires_at = absolute_expires_at from user_sessions")).toBe("t");

        admin(
            "update user_sessions set last_used_at = now() - interval '2 hours', expires_at = now() + interval '1 hour', absolute_expires_at = now() + interval '80 days'",
        );
        await repo.sessionUser(hash);
        expect(
            admin(
                "select expires_at between now() + interval '29 days' and now() + interval '31 days' from user_sessions",
            ),
        ).toBe("t");
    });

    it("uso recente não escreve no banco (renova no máximo 1×/hora)", async () => {
        const { hash } = await signIn();
        admin("update user_sessions set expires_at = now() + interval '1 hour'");
        await repo.sessionUser(hash);
        expect(admin("select expires_at < now() + interval '2 hours' from user_sessions")).toBe(
            "t",
        );
    });

    it("sair apaga a sessão no banco: o cookie antigo não volta a valer", async () => {
        const { hash } = await signIn();
        await repo.signOut(hash);
        expect(await repo.sessionUser(hash)).toBeNull();
        expect(count("select 1 from user_sessions")).toBe(0);
    });

    it("sair de um aparelho não derruba o outro", async () => {
        const a = await signIn();
        const b = await signIn();
        await repo.signOut(a.hash);
        expect(await repo.sessionUser(b.hash)).not.toBeNull();
    });

    it("a conta é o sub: mesmo sub reaproveita a conta e atualiza e-mail e nome", async () => {
        await signIn();
        const { hash } = await signIn({ ...leo, email: "novo@example.com", name: "Leonardo" });
        expect(count("select 1 from users")).toBe(1);
        expect(await repo.sessionUser(hash)).toMatchObject({
            email: "novo@example.com",
            name: "Leonardo",
        });
    });

    it("outro sub com o mesmo e-mail é outra conta (o e-mail não dá acesso)", async () => {
        const a = await signIn();
        const b = await signIn({ ...leo, sub: "outro-sub" });
        const ua = await repo.sessionUser(a.hash);
        const ub = await repo.sessionUser(b.hash);
        expect(ua?.id).not.toBe(ub?.id);
    });

    it("cada login gera token novo; o login limpa as sessões vencidas da conta", async () => {
        const a = await signIn();
        admin("update user_sessions set expires_at = now() - interval '1 second'");
        const b = await signIn();
        expect(a.hash).not.toBe(b.hash);
        expect(count("select 1 from user_sessions")).toBe(1);
    });

    it("o banco recusa hash fora do formato e sessão com expiração além do teto", () => {
        admin("insert into users (google_sub, email) values ('s', 'a@b.c')");
        expect(() =>
            admin(
                "insert into user_sessions (user_id, token_hash, expires_at, absolute_expires_at) values (1, 'nao-e-hash', now(), now())",
            ),
        ).toThrow();
        expect(() =>
            admin(
                `insert into user_sessions (user_id, token_hash, expires_at, absolute_expires_at) values (1, '${"a".repeat(64)}', now() + interval '2 days', now() + interval '1 day')`,
            ),
        ).toThrow();
    });

    it("apagar a conta leva as sessões junto", async () => {
        const { hash } = await signIn();
        admin("delete from users");
        expect(await repo.sessionUser(hash)).toBeNull();
        expect(count("select 1 from user_sessions")).toBe(0);
    });
});
