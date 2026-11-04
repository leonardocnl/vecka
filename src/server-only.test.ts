import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// security §4: todo módulo que lê segredo ou fala com o banco importa "server-only", e aí o build
// falha se um componente de cliente o importar.
const srcDir = import.meta.dirname;
// process.env.NODE_ENV não é segredo (o Next o troca no build, até no cliente); qualquer outro é
const touchesSecretsOrDb =
    /process\.env(?!\.NODE_ENV\b)|createDb\(|@neondatabase|from "\.\/client"|: Db\b/;

const files = readdirSync(srcDir, { recursive: true, encoding: "utf8" }).filter(
    (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f),
);

describe("server-only (security §4)", () => {
    it("todo módulo com segredo ou banco importa server-only", () => {
        const missing = files.filter((f) => {
            const source = readFileSync(join(srcDir, f), "utf8");
            return touchesSecretsOrDb.test(source) && !source.includes('import "server-only";');
        });
        expect(missing).toEqual([]);
    });
});
