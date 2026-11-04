import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.APP_URL = "http://localhost:3000";
const { config, proxy } = await import("./proxy");

const runs = (url: string) => unstable_doesMiddlewareMatch({ config, nextConfig: {}, url });

describe("proxy", () => {
    it("deixa passar os arquivos estáticos públicos", () => {
        for (const url of ["/appearance.js", "/paper.png", "/wordmark.svg", "/f.woff2", "/f.woff"])
            expect(runs(url), url).toBe(false);
    });

    it("continua barrando as rotas dinâmicas", () => {
        for (const url of ["/", "/entrar", "/dia/2026-11-04", "/api/auth/google"])
            expect(runs(url), url).toBe(true);
    });

    it("sem sessão, redireciona para /entrar", () => {
        const response = proxy(new NextRequest("http://localhost:3000/"));
        expect(response.headers.get("location")).toBe("http://localhost:3000/entrar");
    });

    it("páginas /dev/ passam sem sessão só fora de produção", () => {
        const dev = () => proxy(new NextRequest("http://localhost:3000/dev/sombras"));
        expect(dev().headers.get("location")).toBeNull();
        vi.stubEnv("NODE_ENV", "production");
        expect(dev().headers.get("location")).toBe("http://localhost:3000/entrar");
        vi.unstubAllEnvs();
    });
});
