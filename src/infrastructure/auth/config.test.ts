import { describe, expect, it } from "vitest";
import { appUrl } from "./config";

describe("appUrl", () => {
    it("devolve a origem, com ou sem barra final", () => {
        expect(appUrl({ APP_URL: "http://localhost:3000" })).toBe("http://localhost:3000");
        expect(appUrl({ APP_URL: " https://dievecka.vercel.app/ " })).toBe(
            "https://dievecka.vercel.app",
        );
    });

    it("monta o redirect_uri a partir dela", () => {
        const origin = appUrl({ APP_URL: "https://dievecka.vercel.app" });
        expect(new URL("/api/auth/google/callback", origin).toString()).toBe(
            "https://dievecka.vercel.app/api/auth/google/callback",
        );
    });

    it("falha fechada sem APP_URL ou com caminho", () => {
        expect(() => appUrl({})).toThrow("APP_URL não definida");
        expect(() => appUrl({ APP_URL: "https://dievecka.vercel.app/x" })).toThrow();
        expect(() => appUrl({ APP_URL: "nada" })).toThrow();
    });
});
