import { describe, expect, it } from "vitest";
import { isAllowedEmail, parseAllowedEmails } from "./auth";

describe("lista de e-mails permitidos", () => {
    const allowed = parseAllowedEmails(" Leo@Example.com ,outra@example.com,, ");

    it("aceita quem está na lista, sem diferença de maiúsculas ou espaços", () => {
        expect(isAllowedEmail("leo@example.com", allowed)).toBe(true);
        expect(isAllowedEmail("  OUTRA@example.com", allowed)).toBe(true);
    });

    it("recusa quem não está", () => {
        expect(isAllowedEmail("intruso@example.com", allowed)).toBe(false);
        expect(isAllowedEmail("leo@example.com.evil.com", allowed)).toBe(false);
        expect(isAllowedEmail("", allowed)).toBe(false);
    });

    it("lista vazia ou ausente não deixa ninguém entrar", () => {
        expect(parseAllowedEmails(undefined).size).toBe(0);
        expect(parseAllowedEmails("").size).toBe(0);
        expect(parseAllowedEmails(" , ").size).toBe(0);
        expect(isAllowedEmail("leo@example.com", parseAllowedEmails(""))).toBe(false);
    });
});
