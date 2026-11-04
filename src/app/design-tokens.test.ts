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
