import { describe, expect, it } from "vitest";
import {
    addDays,
    clockIn,
    dialLine,
    fullDate,
    pendingDaysIn,
    recurrenceTag,
    daysBetween,
    daysText,
    hasPendingOn,
    isLate,
    isValidDate,
    monthGrid,
    movableFor,
    pendingCount,
    shortDate,
    swapPositions,
    tasksFor,
    todayIn,
    weekDates,
    weekday,
    type Task,
} from "./tasks";

let seq = 0;
const task = (over: Partial<Task> = {}): Task => ({
    id: ++seq,
    text: `t${seq}`,
    date: "2026-11-03",
    recurringDays: null,
    time: null,
    note: null,
    position: seq,
    doneDates: [],
    ...over,
});

describe("fuso America/Sao_Paulo", () => {
    const tz = "America/Sao_Paulo";

    it("antes das 03:00 UTC ainda é o dia anterior em São Paulo", () => {
        const now = new Date("2026-11-04T02:30:00Z");
        expect(todayIn(tz, now)).toBe("2026-11-03");
        expect(clockIn(tz, now)).toBe("23:30");
    });

    it("à meia-noite de São Paulo o dia vira", () => {
        const now = new Date("2026-11-04T03:00:00Z");
        expect(todayIn(tz, now)).toBe("2026-11-04");
        expect(clockIn(tz, now)).toBe("00:00");
    });

    it("o fuso do usuário manda, não o do servidor", () => {
        const now = new Date("2026-11-04T02:30:00Z");
        expect(todayIn("Europe/Stockholm", now)).toBe("2026-11-04");
    });
});

describe("janela de 7 dias", () => {
    it("hoje + 6 dias, atravessando mês e ano", () => {
        expect(weekDates("2026-12-28")).toEqual([
            "2026-12-28",
            "2026-12-29",
            "2026-12-30",
            "2026-12-31",
            "2027-01-01",
            "2027-01-02",
            "2027-01-03",
        ]);
    });

    it("datas e dias da semana", () => {
        expect(weekday("2026-11-01")).toBe(0); // domingo
        expect(weekday("2026-11-03")).toBe(2); // terça
        expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
        expect(daysBetween("2026-11-03", "2026-11-22")).toBe(19);
        expect(isValidDate("2026-02-31")).toBe(false);
        expect(isValidDate("2028-02-29")).toBe(true);
        expect(shortDate("2026-10-31")).toBe("31/10");
    });
});

describe("recorrência", () => {
    it("recorrente aparece só nos dias da semana escolhidos", () => {
        const r = task({ date: null, recurringDays: [1, 3] }); // segunda e quarta
        expect(tasksFor([r], "2026-11-02")).toHaveLength(1); // segunda
        expect(tasksFor([r], "2026-11-03")).toHaveLength(0); // terça
        expect(tasksFor([r], "2026-11-04")).toHaveLength(1); // quarta
    });

    it("concluir num dia não conclui os outros", () => {
        const r = task({ date: null, recurringDays: [1, 3], doneDates: ["2026-11-02"] });
        expect(pendingCount([r], "2026-11-02")).toBe(0);
        expect(pendingCount([r], "2026-11-04")).toBe(1);
    });

    it("texto dos dias", () => {
        expect(daysText([1, 3, 5])).toBe("segunda, quarta e sexta");
        expect(daysText([0])).toBe("domingo");
        expect(daysText([0, 1, 2, 3, 4, 5, 6])).toBe("todos os dias");
    });
});

describe("ordem das tarefas", () => {
    it("com horário (crescente) → sem horário (ordem manual) → feitas", () => {
        const late = task({ time: "18:00" });
        const early = task({ time: "07:30" });
        const second = task({ position: 20 });
        const first = task({ position: 10 });
        const done = task({ time: "06:00", doneDates: ["2026-11-03"] });
        const order = tasksFor([late, done, second, early, first], "2026-11-03").map((t) => t.id);
        expect(order).toEqual([early.id, late.id, first.id, second.id, done.id]);
    });

    it("só sem horário e não feitas sobem e descem", () => {
        const a = task({ position: 1 });
        const b = task({ position: 2 });
        const timed = task({ time: "09:00" });
        const done = task({ doneDates: ["2026-11-03"] });
        expect(movableFor([a, b, timed, done], "2026-11-03").map((t) => t.id)).toEqual([
            a.id,
            b.id,
        ]);
        expect(swapPositions([a, b], "2026-11-03", b.id, -1)).toEqual([
            { id: b.id, position: 1 },
            { id: a.id, position: 2 },
        ]);
        expect(swapPositions([a, b], "2026-11-03", a.id, -1)).toBeNull();
        expect(swapPositions([a, b], "2026-11-03", timed.id, 1)).toBeNull();
    });

    it("posições iguais ainda trocam", () => {
        const a = task({ position: 5 });
        const b = task({ position: 5 });
        expect(swapPositions([a, b], "2026-11-03", a.id, 1)).toEqual([
            { id: a.id, position: 6 },
            { id: b.id, position: 5 },
        ]);
    });
});

describe("atraso, ponto e textos", () => {
    it("atrasada só hoje, com horário passado e não feita", () => {
        const t = task({ time: "09:00" });
        expect(isLate(t, "2026-11-03", "2026-11-03", "09:01")).toBe(true);
        expect(isLate(t, "2026-11-03", "2026-11-03", "09:00")).toBe(false);
        expect(isLate(t, "2026-11-03", "2026-11-02", "23:59")).toBe(false);
        expect(
            isLate({ ...t, doneDates: ["2026-11-03"] }, "2026-11-03", "2026-11-03", "10:00"),
        ).toBe(false);
    });

    it("ponto do calendário: só avulsa pendente", () => {
        const r = task({ date: null, recurringDays: [2] });
        expect(hasPendingOn([r], "2026-11-03")).toBe(false);
        expect(hasPendingOn([task()], "2026-11-03")).toBe(true);
        expect(hasPendingOn([task({ doneDates: ["2026-11-03"] })], "2026-11-03")).toBe(false);
    });

    it("linha ao lado das placas", () => {
        expect(dialLine("2026-11-04", 0, "14:35")).toBe("novembro · 14:35");
        expect(dialLine("2026-11-05", 1, "14:35")).toBe("novembro · amanhã");
        expect(dialLine("2026-11-09", 5, "14:35")).toBe("novembro · em 5 dias");
        expect(dialLine("2026-11-03", -1, "14:35")).toBe("novembro · ontem");
        expect(dialLine("2026-10-30", -5, "14:35")).toBe("outubro · há 5 dias");
        expect(fullDate("2026-11-04")).toBe("4 de novembro de 2026");
    });

    it("etiqueta da recorrente", () => {
        expect(recurrenceTag([0, 1, 2, 3, 4, 5, 6])).toBe("↻ diário");
        expect(recurrenceTag([3, 1])).toBe("↻ seg qua");
        expect(recurrenceTag([0, 6])).toBe("↻ dom sáb");
    });

    it("pendentes do mês: dias com avulsa não feita, de hoje em diante", () => {
        const list = [
            task({ id: 1, date: "2026-11-02" }), // passado: não conta
            task({ id: 2, date: "2026-11-04" }),
            task({ id: 3, date: "2026-11-04" }), // mesmo dia: conta uma vez
            task({ id: 4, date: "2026-11-05", doneDates: ["2026-11-05"] }), // feita
            task({ id: 5, date: null, recurringDays: [1] }), // recorrente: não conta
            task({ id: 6, date: "2026-11-30" }),
            task({ id: 7, date: "2026-12-01" }), // outro mês
        ];
        expect(pendingDaysIn(list, 2026, 10, "2026-11-04")).toBe(2);
    });

    it("mês sempre em 6 semanas começando no domingo", () => {
        const grid = monthGrid(2026, 10); // novembro de 2026 começa num domingo
        expect(grid).toHaveLength(6);
        expect(grid[0]![0]).toBe("2026-11-01");
        expect(grid.flat().filter(Boolean)).toHaveLength(30);
        expect(monthGrid(2027, 1)[0]!.slice(0, 1)).toEqual([null]); // fev/2027 começa segunda
    });
});
