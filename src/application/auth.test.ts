import { describe, expect, it, vi } from "vitest";
import { parseAllowedEmails } from "@/domain/auth";
import { completeGoogleSignIn, type GoogleSignInDeps } from "./auth";

const attempt = { state: "s".repeat(43), verifier: "v".repeat(43), nonce: "n".repeat(43) };

function deps(email = "leo@example.com") {
    const repository = {
        signIn: vi.fn(async () => {}),
        sessionUser: vi.fn(async () => null),
        signOut: vi.fn(async () => {}),
    };
    const d = {
        repository,
        allowedEmails: parseAllowedEmails("leo@example.com"),
        exchangeCode: vi.fn(async () => "id-token"),
        verifyIdToken: vi.fn(async () => ({ sub: "123", email, name: "Leo" })),
        newSessionToken: () => "token",
        hashSessionToken: (t: string) => `hash(${t})`,
    } satisfies GoogleSignInDeps;
    return d;
}

describe("completeGoogleSignIn", () => {
    it("quem está na lista ganha sessão; o banco recebe só o hash", async () => {
        const d = deps();
        const result = await completeGoogleSignIn(d, { code: "c", state: attempt.state, attempt });
        expect(result).toEqual({ status: "ok", sessionToken: "token" });
        expect(d.exchangeCode).toHaveBeenCalledWith("c", attempt.verifier);
        expect(d.verifyIdToken).toHaveBeenCalledWith("id-token", attempt.nonce);
        expect(d.repository.signIn).toHaveBeenCalledWith(
            { sub: "123", email: "leo@example.com", name: "Leo" },
            "hash(token)",
        );
    });

    it("quem não está na lista não ganha sessão nem registro no banco", async () => {
        const d = deps("intruso@example.com");
        const result = await completeGoogleSignIn(d, { code: "c", state: attempt.state, attempt });
        expect(result).toEqual({ status: "denied" });
        expect(d.repository.signIn).not.toHaveBeenCalled();
    });

    it.each([
        [
            "sem o cookie do OAuth (outro navegador)",
            { code: "c", state: attempt.state, attempt: null },
        ],
        ["state diferente (CSRF)", { code: "c", state: "x".repeat(43), attempt }],
        ["sem state", { code: "c", state: null, attempt }],
        ["sem code", { code: null, state: attempt.state, attempt }],
        ["code gigante", { code: "c".repeat(5000), state: attempt.state, attempt }],
    ])("recusa %s sem falar com o Google", async (_, input) => {
        const d = deps();
        const result = await completeGoogleSignIn(d, input);
        expect(result.status).toBe("invalid");
        expect(d.exchangeCode).not.toHaveBeenCalled();
        expect(d.repository.signIn).not.toHaveBeenCalled();
    });

    it("id_token inválido interrompe antes do banco", async () => {
        const d = deps();
        d.verifyIdToken.mockRejectedValueOnce(new Error("nonce"));
        await expect(
            completeGoogleSignIn(d, { code: "c", state: attempt.state, attempt }),
        ).rejects.toThrow();
        expect(d.repository.signIn).not.toHaveBeenCalled();
    });
});
