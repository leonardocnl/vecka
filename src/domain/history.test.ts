import { describe, expect, it } from "vitest";
import { dateLine, hasHistoryOn, historyFor, monthRange, type HistoryTask } from "./tasks";

// Regras do histórico (fase 3). 2026-11-02 é segunda-feira.
const t = (over: Partial<HistoryTask>): HistoryTask => ({
    id: 1,
    text: "x",
    date: null,
    recurringDays: null,
    time: null,
    note: null,
    position: 0,
    doneDates: [],
    createdOn: "2026-10-01",
    ...over,
});

describe("historyFor", () => {
    it("avulsa aparece só na data dela", () => {
        const list = [t({ id: 1, date: "2026-11-02" })];
        expect(historyFor(list, "2026-11-02").map((x) => x.id)).toEqual([1]);
        expect(historyFor(list, "2026-11-03")).toEqual([]);
    });

    it("recorrente criada no meio do mês só vale a partir do dia de criação", () => {
        // toda segunda, criada na quarta 2026-11-11
        const list = [t({ recurringDays: [1], createdOn: "2026-11-11" })];
        expect(historyFor(list, "2026-11-02")).toEqual([]);
        expect(historyFor(list, "2026-11-09")).toEqual([]);
        expect(historyFor(list, "2026-11-16")).toHaveLength(1);
        // criada numa segunda: já vale nesse dia
        expect(
            historyFor([t({ recurringDays: [1], createdOn: "2026-11-09" })], "2026-11-09"),
        ).toHaveLength(1);
    });

    it("recorrente só cai nos dias da semana dela", () => {
        const list = [t({ recurringDays: [1, 3] })];
        expect(historyFor(list, "2026-11-02")).toHaveLength(1); // segunda
        expect(historyFor(list, "2026-11-03")).toEqual([]); // terça
        expect(historyFor(list, "2026-11-04")).toHaveLength(1); // quarta
    });

    it("feita = conclusão naquela data; ordem: horário, sem horário, feitas", () => {
        const list = [
            t({ id: 1, date: "2026-11-02", position: 2, doneDates: ["2026-11-02"] }),
            t({ id: 2, date: "2026-11-02", position: 3 }),
            t({ id: 3, date: "2026-11-02", time: "09:00" }),
            t({ id: 4, recurringDays: [1], position: 1, doneDates: ["2026-10-26"] }),
            t({ id: 5, date: "2026-11-02", time: "08:00" }),
        ];
        expect(historyFor(list, "2026-11-02").map((x) => x.id)).toEqual([5, 3, 4, 2, 1]);
        // a conclusão de outra semana não conta
        expect(historyFor(list, "2026-10-26").map((x) => x.id)).toEqual([4]);
    });

    it("removida não chega (o servidor filtra); sem tarefas, sem ponto", () => {
        expect(hasHistoryOn([], "2026-11-02")).toBe(false);
        expect(hasHistoryOn([t({ date: "2026-11-02" })], "2026-11-02")).toBe(true);
        expect(
            hasHistoryOn([t({ recurringDays: [1], createdOn: "2026-11-05" })], "2026-11-02"),
        ).toBe(false);
    });
});

describe("textos e intervalos", () => {
    it("data do dia passado", () => {
        expect(dateLine("2026-11-03", -1, "10:00")).toBe("3 de novembro de 2026 — ontem");
        expect(dateLine("2026-10-30", -5, "10:00")).toBe("30 de outubro de 2026 — há 5 dias");
    });

    it("mês inteiro", () => {
        expect(monthRange(2026, 1)).toEqual({ from: "2026-02-01", to: "2026-02-28" });
        expect(monthRange(2026, 11)).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    });
});
