import { describe, expect, it } from "vitest";
import { hasIntegrationKey, integrationConfig } from "./integration";

const key = "k".repeat(64);

describe("chave da integração", () => {
    it("sem as duas variáveis, ou com chave curta, a API fica desligada", () => {
        expect(integrationConfig({})).toBeNull();
        expect(integrationConfig({ INTEGRATION_API_KEY: key })).toBeNull();
        expect(integrationConfig({ INTEGRATION_USER_EMAIL: "a@x.com" })).toBeNull();
        const short = { INTEGRATION_API_KEY: "curta", INTEGRATION_USER_EMAIL: "a@x.com" };
        expect(integrationConfig(short)).toBeNull();
        const ok = { INTEGRATION_API_KEY: ` ${key} `, INTEGRATION_USER_EMAIL: "a@x.com" };
        expect(integrationConfig(ok)).toEqual({ key, email: "a@x.com" });
    });

    it("aceita só Bearer com a chave exata", () => {
        expect(hasIntegrationKey(`Bearer ${key}`, key)).toBe(true);
        for (const header of [
            null,
            "",
            key,
            `bearer ${key}`,
            `Bearer ${key}x`,
            `Bearer ${key.slice(1)}`,
            `Bearer  ${key}`,
            `Basic ${key}`,
        ]) {
            expect(hasIntegrationKey(header, key), String(header)).toBe(false);
        }
    });
});
