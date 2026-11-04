import { describe, expect, it } from "vitest";
import { schemas } from "./task-schemas";

const ok = (schema: keyof typeof schemas, input: unknown) =>
    schemas[schema].safeParse(input).success;

describe("schemas das ações de tarefas", () => {
    const add = { text: "Comprar pão", date: "2026-11-03", days: null, time: "07:30" };

    it("aceita entrada válida e apara o texto", () => {
        expect(ok("add", add)).toBe(true);
        expect(schemas.add.parse({ ...add, text: "  oi  " }).text).toBe("oi");
        expect(ok("add", { ...add, days: [0, 6], time: null })).toBe(true);
    });

    it.each([
        ["chave desconhecida", { ...add, userId: 2 }],
        ["texto vazio", { ...add, text: "   " }],
        ["texto com 301", { ...add, text: "a".repeat(301) }],
        ["data inexistente", { ...add, date: "2026-02-31" }],
        ["data em outro formato", { ...add, date: "03/11/2026" }],
        ["horário 24:00", { ...add, time: "24:00" }],
        ["horário sem zero", { ...add, time: "7:30" }],
        ["dia da semana 7", { ...add, days: [7] }],
        ["dia repetido", { ...add, days: [1, 1] }],
        ["dia fracionado", { ...add, days: [1.5] }],
        ["sem campo", { text: "a", date: "2026-11-03" }],
    ])("recusa adicionar com %s", (_, input) => {
        expect(ok("add", input)).toBe(false);
    });

    it("nota até 1000 e vazia vira null", () => {
        const base = { id: 1, text: "a", time: null, days: null, date: "2026-11-03" };
        expect(schemas.update.parse({ ...base, note: "  " }).note).toBeNull();
        expect(ok("update", { ...base, note: "n".repeat(1000) })).toBe(true);
        expect(ok("update", { ...base, note: "n".repeat(1001) })).toBe(false);
    });

    it.each([
        ["id negativo", { id: -1 }],
        ["id texto", { id: "1" }],
        ["id gigante", { id: 2 ** 31 }],
        ["chave extra", { id: 1, user_id: 1 }],
    ])("recusa remover com %s", (_, input) => {
        expect(ok("remove", input)).toBe(false);
    });

    it("mover só para cima ou para baixo", () => {
        expect(ok("move", { id: 1, date: "2026-11-03", dir: -1 })).toBe(true);
        expect(ok("move", { id: 1, date: "2026-11-03", dir: 2 })).toBe(false);
    });
});
