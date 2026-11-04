import { describe, expect, it } from "vitest";
import { flipPlan, ms, type Snapshot } from "./motion";

const a = {} as Element;
const b = {} as Element;
const c = {} as Element;
const snap = (pairs: [Element, number][]): Snapshot => new Map(pairs);

describe("FLIP da tarefa", () => {
    it("abrindo: o que estava acima sai de onde estava e chega ao lugar", () => {
        const plan = flipPlan(
            snap([
                [a, 100],
                [b, 152],
            ]),
            snap([
                [a, 100],
                [b, 252],
            ]),
            null,
        );
        expect(plan.has(a)).toBe(false);
        expect(plan.get(b)).toEqual({ from: -100, to: 0 });
    });

    it("fechando: sai de onde está e chega à posição fechada", () => {
        const plan = flipPlan(snap([[b, 252]]), snap([[b, 252]]), snap([[b, 152]]));
        expect(plan.get(b)).toEqual({ from: 0, to: -100 });
    });

    it("interrompido no meio: parte da posição na tela, sem salto", () => {
        // abriu até a metade (b em 202 na tela) e o toque fecha de novo
        const plan = flipPlan(snap([[b, 202]]), snap([[b, 252]]), snap([[b, 152]]));
        expect(plan.get(b)).toEqual({ from: -50, to: -100 });
    });

    it("peça nova sai do lugar", () => {
        expect(flipPlan(snap([]), snap([[c, 40]]), null).has(c)).toBe(false);
    });
});

describe("durações do CSS", () => {
    it("lê ms e s", () => {
        expect(ms("350ms")).toBe(350);
        expect(ms(".35s")).toBe(350);
        expect(ms("0s")).toBe(0);
    });
});
