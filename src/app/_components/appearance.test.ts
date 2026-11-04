import { describe, expect, it } from "vitest";
import { parseFontStep, parseTheme } from "./appearance";

describe("preferências do aparelho", () => {
    it("tema só claro ou escuro", () => {
        expect(parseTheme("dark")).toBe("dark");
        expect(parseTheme("light")).toBe("light");
        expect(parseTheme("<script>")).toBeNull();
        expect(parseTheme(null)).toBeNull();
    });

    it("letra em 4 passos; qualquer outra coisa volta ao padrão", () => {
        expect(parseFontStep("0")).toBe(0);
        expect(parseFontStep("3")).toBe(3);
        for (const bad of [null, "4", "-1", "1.5", "abc", ""]) expect(parseFontStep(bad)).toBe(1);
    });
});
