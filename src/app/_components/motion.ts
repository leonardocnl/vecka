// Movimento com JS só onde o CSS não alcança: a tarefa abrindo no lugar (FLIP) e esperar uma
// transição terminar antes de tirar a peça da tela. A mola e as durações vêm do globals.css.

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const token = (name: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** "350ms" ou ".35s" em milissegundos. */
export const ms = (value: string) => parseFloat(value) * (/[^m]s$/.test(value) ? 1000 : 1);

/** true se todas as animações da peça (e de dentro dela) terminaram; false se alguma foi interrompida. */
export const settled = (el: Element): Promise<boolean> =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)).then(
        () => true,
        () => false,
    );

// ---------- FLIP do card do dia ----------
//
// Cada peça que se move (.task, .card-foot) é medida antes e depois da mudança; a diferença vira um
// translateY que vai até 0 (abrindo) ou até a posição fechada (fechando). O meio da placa
// (.card-body) estica com scaleY. O painel da tarefa desliza de baixo da linha. Como a medida de
// "antes" é a posição na tela (com o transform do momento), tocar de novo no meio parte de onde a
// peça está: nada salta.

/** Posição de cada peça: o topo na tela; para o meio da placa, a altura. */
export type Snapshot = Map<Element, number>;

const movers = (card: Element) => [...card.querySelectorAll(".task, .card-foot")];

export function measure(card: Element): Snapshot {
    const snap: Snapshot = new Map();
    for (const el of movers(card)) snap.set(el, el.getBoundingClientRect().top);
    const body = card.querySelector(".card-body");
    if (body) snap.set(body, body.getBoundingClientRect().height);
    return snap;
}

/** Para as animações em curso: as peças voltam à posição do layout. */
export function stopFlip(card: Element) {
    for (const el of [...movers(card), ...card.querySelectorAll(".card-body, .task-panel > div")])
        for (const a of el.getAnimations()) if (!(a instanceof CSSTransition)) a.cancel();
}

/** Mede o layout como se a tarefa já estivesse fechada (sem mexer no React). */
export function measureClosed(card: Element, task: Element): Snapshot {
    const panel = task.querySelector<HTMLElement>(".task-panel");
    task.classList.remove("open");
    if (panel) panel.style.display = "none";
    const snap = measure(card);
    task.classList.add("open");
    if (panel) panel.style.removeProperty("display");
    return snap;
}

/**
 * De onde cada peça sai e aonde chega, em px a partir da posição atual do layout (pura, testada).
 * Sem "antes" (peça nova), sai do lugar; sem "depois", chega ao lugar.
 */
export function flipPlan(first: Snapshot, layout: Snapshot, last: Snapshot | null) {
    const plan = new Map<Element, { from: number; to: number }>();
    for (const [el, now] of layout) {
        const from = (first.get(el) ?? now) - now;
        const to = (last?.get(el) ?? now) - now;
        if (Math.abs(from) > 0.5 || Math.abs(to) > 0.5) plan.set(el, { from, to });
    }
    return plan;
}

/**
 * Toca o plano: translateY nas peças, scaleY no meio da placa e, nos painéis, o deslize de baixo
 * da linha (abrindo, até 0) ou de volta para lá (fechando, até -altura). Devolve as animações.
 */
export function playFlip(
    card: Element,
    first: Snapshot,
    last: Snapshot | null,
    panels: { el: Element; from: number | null; closing: boolean }[],
): Animation[] {
    const layout = measure(card);
    const options: KeyframeAnimationOptions = {
        duration: ms(token("--duration-small")),
        easing: token("--ease-spring"),
        fill: "forwards",
    };
    const anims: Animation[] = [];
    for (const [el, { from, to }] of flipPlan(first, layout, last)) {
        const h = layout.get(el)!;
        const at = (d: number) =>
            el.classList.contains("card-body")
                ? `scaleY(${h > 0 ? (h + d) / h : 1})`
                : `translateY(${d}px)`;
        anims.push(el.animate({ transform: [at(from), at(to)] }, options));
    }
    for (const { el, from, closing } of panels) {
        const height = el.getBoundingClientRect().height;
        const at = (d: number) => `translateY(${d}px)`;
        anims.push(
            el.animate({ transform: [at(from ?? -height), at(closing ? -height : 0)] }, options),
        );
    }
    for (const a of anims) {
        const el = (a.effect as KeyframeEffect).target as HTMLElement;
        el.style.willChange = "transform";
        a.finished.then(
            () => el.style.removeProperty("will-change"),
            () => el.style.removeProperty("will-change"),
        );
    }
    return anims;
}

/** Onde cada painel aberto está agora (px acima do lugar dele), pelo id da tarefa. */
export function panelOffsets(card: Element): Map<string, number> {
    const out = new Map<string, number>();
    for (const el of card.querySelectorAll(".task-panel > div")) {
        const t = getComputedStyle(el).transform;
        out.set(el.parentElement!.id, t === "none" ? 0 : new DOMMatrixReadOnly(t).m42);
    }
    return out;
}
