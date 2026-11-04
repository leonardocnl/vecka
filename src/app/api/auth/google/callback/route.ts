import { NextResponse, type NextRequest } from "next/server";
import { completeGoogleSignIn } from "@/application/auth";
import { OAUTH_COOKIE, SESSION_ABSOLUTE_DAYS, SESSION_COOKIE } from "@/domain/auth";
import { appUrl, googleConfig } from "@/infrastructure/auth/config";
import {
    exchangeCode,
    googleKeys,
    idTokenKid,
    parseAttempt,
    verifyIdToken,
} from "@/infrastructure/auth/google";
import { hashSessionToken, newSessionToken } from "@/infrastructure/auth/session-token";
import { authRepository, secureCookie } from "@/app/_auth/session";

// Volta do Google (o único lugar que recebe query params: code e state, security.md §8).
// Qualquer falha vai para a mesma tela genérica; o motivo fica só no log do servidor.
export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const attempt = parseAttempt(request.cookies.get(OAUTH_COOKIE)?.value);
    const to = (path: string) => {
        const response = NextResponse.redirect(new URL(path, appUrl()), 303);
        // o cookie do OAuth vale para uma tentativa só
        response.cookies.set(OAUTH_COOKIE, "", { ...secureCookie, maxAge: 0 });
        response.headers.set("Cache-Control", "no-store");
        return response;
    };

    try {
        const config = googleConfig();
        const redirectUri = new URL("/api/auth/google/callback", appUrl()).toString();
        const result = await completeGoogleSignIn(
            {
                repository: authRepository(),
                allowedEmails: config.allowedEmails,
                exchangeCode: (code, verifier) =>
                    exchangeCode({ code, verifier, redirectUri, ...config }),
                verifyIdToken: async (idToken, nonce) =>
                    verifyIdToken(idToken, {
                        keys: await googleKeys(idTokenKid(idToken)),
                        clientId: config.clientId,
                        nonce,
                        now: new Date(),
                    }),
                newSessionToken,
                hashSessionToken,
            },
            { code: params.get("code"), state: params.get("state"), attempt },
        );
        if (result.status === "invalid") {
            console.error("login recusado:", result.reason);
            return to("/entrar/erro");
        }
        if (result.status === "denied") {
            console.error("login recusado: e-mail fora da lista");
            return to("/entrar/erro");
        }
        const response = to("/");
        response.cookies.set(SESSION_COOKIE, result.sessionToken, {
            ...secureCookie,
            maxAge: SESSION_ABSOLUTE_DAYS * 24 * 60 * 60,
        });
        return response;
    } catch (error) {
        console.error("login falhou:", (error as Error).message);
        return to("/entrar/erro");
    }
}

const notFound = () => new Response(null, { status: 404 });
export { notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
