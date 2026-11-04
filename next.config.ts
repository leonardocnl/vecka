import type { NextConfig } from "next";
import { securityHeaders } from "./src/infrastructure/http/security-headers";

const nextConfig: NextConfig = {
    // security.md §10: sem X-Powered-By
    poweredByHeader: false,
    async headers() {
        // em todas as respostas: páginas, API, 404 e arquivos estáticos (security.md §10)
        return [
            {
                source: "/:path*",
                headers: securityHeaders(process.env.NODE_ENV === "development"),
            },
        ];
    },
    turbopack: {
        rules: {
            "*.css": {
                loaders: ["@tailwindcss/turbopack"],
                as: "*.css",
            },
        },
    },
};

export default nextConfig;
