import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

const names = (dev: boolean) => securityHeaders(dev).map((h) => h.key);

describe("security headers (security.md §10)", () => {
    it("carries the six headers in both modes", () => {
        for (const dev of [false, true]) {
            expect(names(dev)).toEqual([
                "Content-Security-Policy",
                "Strict-Transport-Security",
                "X-Content-Type-Options",
                "Referrer-Policy",
                "Permissions-Policy",
                "Cross-Origin-Opener-Policy",
            ]);
        }
    });

    it("production policy has no eval and no wildcard or data: source", () => {
        const csp = contentSecurityPolicy(false);
        expect(csp).not.toContain("unsafe-eval");
        expect(csp).not.toMatch(/\*|data:|blob:|https?:/);
        expect(csp).toContain("frame-ancestors 'none'");
        expect(csp).toContain("img-src 'self';");
        expect(csp).toContain("upgrade-insecure-requests");
    });

    it("only development relaxes eval and websockets (hot reload)", () => {
        const csp = contentSecurityPolicy(true);
        expect(csp).toContain("'unsafe-eval'");
        expect(csp).toContain("connect-src 'self' ws: wss:");
        expect(csp).not.toContain("upgrade-insecure-requests");
    });

    it("turns camera, microphone and geolocation off", () => {
        const value = securityHeaders(false).find((h) => h.key === "Permissions-Policy")?.value;
        for (const feature of ["camera", "microphone", "geolocation"]) {
            expect(value).toContain(`${feature}=()`);
        }
    });
});
