import type { MouseEvent, PointerEvent } from "react";

// Gestos horizontais com pointer events (sem dependência). A lógica pura fica separada da cola
// com o DOM para ser testada (swipe.test.ts).

/** Gestos que começam a menos disto da borda são do Safari (voltar/avançar). */
export const EDGE = 24;
/** Movimento mínimo antes de decidir o eixo. */
export const SLOP = 10;
/** Tarefa: quanto deslizar para concluir (direita) ou remover (esquerda). */
export const TASK_COMMIT = 96;
/** Dial: deslize mínimo para trocar de dia. */
export const DIAL_MIN = 32;

export type Axis = "pending" | "x" | "y";

export const startsAtEdge = (x: number, width: number): boolean => x < EDGE || x > width - EDGE;

/** Só é gesto se for claramente horizontal: |dx| maior que o dobro de |dy|. */
export function axisOf(dx: number, dy: number): Axis {
    if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return "pending";
    return Math.abs(dx) > 2 * Math.abs(dy) ? "x" : "y";
}

/** O que a tarefa faz ao soltar: só depois de passar do limite; antes, volta ao lugar. */
export function taskSwipe(dx: number): "done" | "remove" | null {
    if (dx >= TASK_COMMIT) return "done";
    if (dx <= -TASK_COMMIT) return "remove";
    return null;
}

/** A tarefa acompanha o dedo 1:1 até o limite e resiste depois dele. */
export function resist(dx: number): number {
    const over = Math.abs(dx) - TASK_COMMIT;
    if (over <= 0) return dx;
    return Math.sign(dx) * (TASK_COMMIT + over * 0.35);
}

/** Dial: o ponteiro segue o dedo; ao soltar, anda o número de colunas percorridas (mín. 1). */
export function dialSteps(dx: number, column: number): number {
    if (Math.abs(dx) < DIAL_MIN) return 0;
    return Math.sign(dx) * Math.max(1, Math.round(Math.abs(dx) / column));
}

// ---------- cola com o DOM ----------

type Drag = { id: number; x: number; y: number; axis: Axis; dx: number };
type El = PointerEvent<HTMLElement>;

const drags = new WeakMap<Element, Drag>();
// depois de um gesto, o clique que o navegador dispara ao soltar não vale como toque
const swallowUntil = new WeakMap<Element, number>();

/** pointerdown: começa a acompanhar (fora das bordas da tela). */
export function swipeDown(e: El) {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (startsAtEdge(e.clientX, window.innerWidth)) return;
    drags.set(e.currentTarget, {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        axis: "pending",
        dx: 0,
    });
}

/** pointermove: decide o eixo; se for horizontal, prende o ponteiro e chama onMove. */
export function swipeMove(e: El, onMove: (dx: number, el: HTMLElement) => void) {
    const el = e.currentTarget;
    const drag = drags.get(el);
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    if (drag.axis === "pending") {
        drag.axis = axisOf(dx, e.clientY - drag.y);
        if (drag.axis === "y") {
            // rolagem vertical: o gesto é do navegador
            drags.delete(el);
            return;
        }
        if (drag.axis === "x") el.setPointerCapture(e.pointerId);
    }
    if (drag.axis !== "x") return;
    drag.dx = dx;
    onMove(dx, el);
}

/** pointerup / pointercancel: termina o gesto horizontal (onDone recebe null se cancelado). */
export function swipeEnd(e: El, onDone: (dx: number | null, el: HTMLElement) => void) {
    const el = e.currentTarget;
    const drag = drags.get(el);
    if (!drag || drag.id !== e.pointerId) return;
    drags.delete(el);
    if (drag.axis !== "x") return;
    swallowUntil.set(el, e.timeStamp + 400);
    onDone(e.type === "pointercancel" ? null : drag.dx, el);
}

/** click (fase de captura): engole o clique logo depois de um gesto. */
export function swipeClick(e: MouseEvent<HTMLElement>) {
    const until = swallowUntil.get(e.currentTarget);
    if (until === undefined) return;
    swallowUntil.delete(e.currentTarget);
    if (e.timeStamp <= until) {
        e.preventDefault();
        e.stopPropagation();
    }
}
