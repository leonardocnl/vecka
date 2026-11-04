import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Regra do DESIGN.md: valores visuais só no globals.css. Fora dele, nada de hex, px ou
// valores arbitrários do Tailwind (bg-[#123], text-[17px], w-(--x), [&_svg]:...).
const forbidden = [
    { name: "cor hex", pattern: /#[0-9a-f]{3,8}\b/i },
    { name: "px", pattern: /\d+px\b/ },
    { name: "valor arbitrário do Tailwind", pattern: /-\[|-\(--|\[&/ },
];

const appDir = import.meta.dirname;
const files = readdirSync(appDir, { recursive: true, encoding: "utf8" }).filter(
    (file) => /\.tsx?$/.test(file) && !file.endsWith(".test.ts"),
);

describe("design tokens", () => {
    it.each(files)("%s usa só tokens", (file) => {
        const source = readFileSync(join(appDir, file), "utf8");
        for (const { name, pattern } of forbidden) {
            expect(source.match(pattern)?.[0], name).toBeUndefined();
        }
    });
});

// No Tailwind v4, w-<nome> e max-w-<nome> acham --spacing-<nome> antes de --container-<nome>: um
// container com o nome de um espaçamento vira, sem aviso, a largura errada (o painel de filtros
// ficou com 1.25rem assim).
describe("nomes de container", () => {
    it("nenhum --container-* tem o nome de um --spacing-*", () => {
        const css = readFileSync(join(appDir, "globals.css"), "utf8");
        const names = (prefix: string) =>
            new Set(
                [...css.matchAll(new RegExp(`--${prefix}-([a-z0-9-]+):`, "g"))].map((m) => m[1]),
            );
        const spacing = names("spacing");
        expect([...names("container")].filter((n) => spacing.has(n))).toEqual([]);
    });
});

// Relevo (docs/design.md): uma luz só. Três elevações de no máximo duas camadas, sombra externa só
// para baixo e sempre com desfoque = 3 × deslocamento; oito tokens de uso escritos sobre elas.
describe("sombras", () => {
    const css = readFileSync(join(appDir, "globals.css"), "utf8");
    const uses = [
        "key",
        "key-dark",
        "key-accent",
        "pressed",
        "field",
        "field-focus",
        "plate",
        "float",
    ];

    it("todo box-shadow do globals.css é um token de uso (ou none)", () => {
        const allowed = [...uses.map((name) => `var(--shadow-${name})`), "none"];
        const used = [...css.matchAll(/box-shadow:\s*([^;]+);/g)].map((m) => m[1]!.trim());
        expect(used.length).toBeGreaterThan(0);
        expect(used.filter((value) => !allowed.includes(value))).toEqual([]);
    });

    it("os tokens de uso são uma das três elevações", () => {
        const def = (name: string) =>
            css.match(new RegExp(`--shadow-${name}:\\s*([^;]+);`))?.[1]?.replace(/\s+/g, " ");
        for (const name of uses.filter((n) => n !== "field-focus")) {
            expect(def(name), name).toMatch(/^var\(--shadow-(sunken|resting|floating)\)$/);
        }
    });

    it("cada elevação tem até 2 camadas, só deslocamento vertical e desfoque = 3 × deslocamento", () => {
        const layers = [
            ...css.matchAll(
                /--(?:shadow-(?:sunken|resting|floating|field-focus)|drop-resting):([^;]+);/g,
            ),
        ].map((m) => m[1]!);
        expect(layers.length).toBe(5);
        for (const value of layers) {
            const parts = [...value.matchAll(/(?:inset )?0 ([\d.]+)px ([\d.]+)px/g)];
            expect(parts.length, value).toBeGreaterThan(0);
            expect(parts.length, value).toBeLessThanOrEqual(2);
            for (const [, y, blur] of parts) {
                // drop-shadow() mede o desfoque pelo desvio padrão: metade do box-shadow
                const k = value.includes("drop-shadow") ? 1.5 : 3;
                expect(Number(blur), value).toBeCloseTo(Number(y) * k);
            }
        }
    });

    it("sem contornos de 1px por cima das sombras", () => {
        expect(css).not.toMatch(/0 0 0 1px/);
    });
});
