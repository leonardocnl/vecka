import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@": new URL("./src", import.meta.url).pathname,
            // fora do Next, server-only lança ao ser importado; nos testes vale a versão vazia
            "server-only": new URL("./node_modules/server-only/empty.js", import.meta.url).pathname,
        },
    },
});
