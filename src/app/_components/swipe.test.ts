import { describe, expect, it } from "vitest";
import { axisOf, dialSteps, EDGE, resist, startsAtEdge, TASK_COMMIT, taskSwipe } from "./swipe";

describe("borda da tela", () => {
    it("ignora gestos que começam a menos de 24 da borda", () => {
        expect(startsAtEdge(0, 390)).toBe(true);
        expect(startsAtEdge(EDGE - 1, 390)).toBe(true);
        expect(startsAtEdge(390 - EDGE + 1, 390)).toBe(true);
        expect(startsAtEdge(EDGE, 390)).toBe(false);
        expect(startsAtEdge(195, 390)).toBe(false);
    });
});

describe("eixo", () => {
    it("espera passar do mínimo antes de decidir", () => {
        expect(axisOf(5, 3)).toBe("pending");
        expect(axisOf(-9, 9)).toBe("pending");
    });
    it("só é horizontal se for claramente horizontal", () => {
        expect(axisOf(30, 5)).toBe("x");
        expect(axisOf(-30, 14)).toBe("x");
        expect(axisOf(30, 15)).toBe("y");
        expect(axisOf(4, 20)).toBe("y");
    });
});

describe("tarefa", () => {
    it("confirma só depois do limite; antes, cancela", () => {
        expect(taskSwipe(TASK_COMMIT - 1)).toBeNull();
        expect(taskSwipe(-(TASK_COMMIT - 1))).toBeNull();
        expect(taskSwipe(0)).toBeNull();
        expect(taskSwipe(TASK_COMMIT)).toBe("done");
        expect(taskSwipe(-TASK_COMMIT)).toBe("remove");
    });
    it("acompanha o dedo até o limite e resiste depois", () => {
        expect(resist(40)).toBe(40);
        expect(resist(-TASK_COMMIT)).toBe(-TASK_COMMIT);
        expect(resist(TASK_COMMIT + 100)).toBeLessThan(TASK_COMMIT + 100);
        expect(resist(TASK_COMMIT + 100)).toBeGreaterThan(TASK_COMMIT);
        expect(resist(-(TASK_COMMIT + 100))).toBe(-resist(TASK_COMMIT + 100));
    });
});

describe("dial", () => {
    it("anda as colunas percorridas, no mínimo uma, no sentido do dedo", () => {
        expect(dialSteps(20, 48)).toBe(0);
        expect(dialSteps(34, 48)).toBe(1);
        expect(dialSteps(-34, 48)).toBe(-1);
        expect(dialSteps(100, 48)).toBe(2);
        expect(dialSteps(-150, 48)).toBe(-3);
    });
});
