import { describe, expect, it } from "vitest";
import { schemas } from "./schemas";

const ok = { externalSource: "n8n", externalId: "abc-1", title: "Pagar conta" };
const upsert = (extra: object) => schemas.upsert.safeParse({ ...ok, ...extra }).success;

describe("schemas da integração", () => {
    it("aceita o mínimo e o completo", () => {
        expect(upsert({})).toBe(true);
        expect(
            upsert({
                dueAt: "2026-11-15T10:00:00-03:00",
                notes: "nota",
                url: "https://example.com/x",
            }),
        ).toBe(true);
        expect(upsert({ dueAt: "2026-11-15T13:00:00Z", notes: null, url: null })).toBe(true);
    });

    it("recusa chave desconhecida, tamanhos e formatos fora do limite", () => {
        for (const bad of [
            { extra: 1 },
            { externalSource: "" },
            { externalSource: "a".repeat(65) },
            { externalSource: "com espaço" },
            { externalId: "" },
            { externalId: "x".repeat(256) },
            { title: "   " },
            { title: "x".repeat(301) },
            { notes: "x".repeat(1001) },
            { dueAt: "2026-11-15T10:00:00" }, // sem fuso
            { dueAt: "2026-11-15" },
            { url: "javascript:alert(1)" },
            { url: "ftp://example.com" },
            { url: `https://example.com/${"x".repeat(2048)}` },
            { title: 1 },
        ]) {
            expect(upsert(bad), JSON.stringify(bad).slice(0, 60)).toBe(false);
        }
    });

    it("nota vazia vira null", () => {
        expect(schemas.upsert.parse({ ...ok, notes: "  " }).notes).toBeNull();
    });

    it("data do GET: só AAAA-MM-DD real e nada mais", () => {
        expect(schemas.pending.safeParse({ date: "2026-11-15" }).success).toBe(true);
        for (const bad of [
            { date: "2026-02-30" },
            { date: "15/11/2026" },
            {},
            { date: "2026-11-15", x: "1" },
        ]) {
            expect(schemas.pending.safeParse(bad).success).toBe(false);
        }
    });
});
