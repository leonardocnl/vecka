import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/domain/auth";
import { appUrl } from "@/infrastructure/auth/config";

// Primeira barreira: sem cookie de sessão, toda rota que não é pública vai para /entrar. A
// conferência de verdade (banco, expiração) é feita na página com requireUser().
const PUBLIC = /^\/(entrar(\/erro)?|api\/auth\/google(\/callback)?)$/;

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    if (PUBLIC.test(pathname) || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
    return NextResponse.redirect(new URL("/entrar", appUrl()), 303);
}

export const config = {
    // arquivos estáticos e ícones ficam de fora
    matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|svg|ico|webmanifest|js|css|woff2?)$).*)"],
};
