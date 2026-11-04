import { NextResponse } from "next/server";
import { OAUTH_COOKIE, OAUTH_TTL_SECONDS } from "@/domain/auth";
import { appUrl, googleConfig } from "@/infrastructure/auth/config";
import { authorizationUrl, newOAuthAttempt, serializeAttempt } from "@/infrastructure/auth/google";
import { secureCookie } from "@/app/_auth/session";

// Começa o login: state, code_verifier e nonce novos, presos a este navegador num cookie __Host-
// de 10 minutos, e redireciona para o Google (security.md §13). Sem APP_URL, a tela de erro
// também falha (500): falha fechada.
export async function GET() {
    let config, origin;
    try {
        config = googleConfig();
        origin = appUrl();
    } catch (error) {
        console.error("login desligado:", (error as Error).message);
        return NextResponse.redirect(new URL("/entrar/erro", appUrl()), 303);
    }
    const attempt = newOAuthAttempt();
    const redirectUri = new URL("/api/auth/google/callback", origin).toString();
    const response = NextResponse.redirect(
        authorizationUrl(attempt, config.clientId, redirectUri),
        303,
    );
    response.cookies.set(OAUTH_COOKIE, serializeAttempt(attempt), {
        ...secureCookie,
        maxAge: OAUTH_TTL_SECONDS,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
}

// security.md §3: métodos não suportados respondem 404
const notFound = () => new Response(null, { status: 404 });
export { notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
