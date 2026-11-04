// Cabeçalhos de segurança de toda resposta (security.md §10). Fonte única: o next.config.ts os
// aplica e o teste unitário lê daqui.

export type HeaderEntry = { key: string; value: string };

function directives(entries: Record<string, string[]>): string {
    return Object.entries(entries)
        .map(([name, sources]) => [name, ...sources].join(" "))
        .join("; ");
}

/**
 * CSP. Em produção `script-src` leva 'unsafe-inline' (sem 'unsafe-eval'): o Next emite scripts
 * inline com o payload de cada resposta (`self.__next_f.push`), que só nonce cobre, e nonce
 * obriga toda página a renderizar por requisição. Registrado em security.md §15.
 */
export function contentSecurityPolicy(development: boolean): string {
    const base: Record<string, string[]> = {
        "default-src": ["'none'"],
        "script-src": ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : [])],
        // Tailwind sai em arquivo; o inline cobre atributos style="" do React.
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'"],
        "font-src": ["'self'"],
        // fetch, XHR e server actions: só o próprio domínio (o HMR do dev usa WebSocket)
        "connect-src": ["'self'", ...(development ? ["ws:", "wss:"] : [])],
        "manifest-src": ["'self'"],
        "frame-src": ["'none'"],
        "object-src": ["'none'"],
        "base-uri": ["'none'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'none'"],
    };
    const policy = directives(base);
    return development ? policy : `${policy}; upgrade-insecure-requests`;
}

export function securityHeaders(development: boolean): HeaderEntry[] {
    return [
        { key: "Content-Security-Policy", value: contentSecurityPolicy(development) },
        {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
        },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
            // nada lê câmera, microfone nem localização
            key: "Permissions-Policy",
            value: [
                "camera=()",
                "microphone=()",
                "geolocation=()",
                "payment=()",
                "usb=()",
                "serial=()",
                "midi=()",
                "display-capture=()",
            ].join(", "),
        },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ];
}
