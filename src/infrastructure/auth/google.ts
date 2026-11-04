import "server-only";
import { createHash, createPublicKey, randomBytes, timingSafeEqual, verify } from "node:crypto";
import type { JsonWebKey } from "node:crypto";
import type { GoogleIdentity, OAuthAttempt } from "@/application/auth";

// Google OAuth 2.0 Authorization Code + PKCE (S256) + state + nonce, à mão, só com o crypto do
// Node (security.md §13). Escopos: openid, email, profile.

export const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
// tolerância para relógios levemente fora de hora
const CLOCK_SKEW_SECONDS = 60;

/** 32 bytes aleatórios em base64url (43 caracteres): state, nonce e code_verifier. */
export const randomToken = (): string => randomBytes(32).toString("base64url");

/** RFC 7636 §4.2: code_challenge = BASE64URL(SHA256(code_verifier)). */
export const pkceChallenge = (verifier: string): string =>
    createHash("sha256").update(verifier).digest("base64url");

/** Comparação em tempo constante (state, nonce). */
export function sameString(a: string, b: string): boolean {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
}

export const newOAuthAttempt = (): OAuthAttempt => ({
    state: randomToken(),
    verifier: randomToken(),
    nonce: randomToken(),
});

export function authorizationUrl(
    attempt: OAuthAttempt,
    clientId: string,
    redirectUri: string,
): string {
    const url = new URL(AUTHORIZE_URL);
    url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state: attempt.state,
        nonce: attempt.nonce,
        code_challenge: pkceChallenge(attempt.verifier),
        code_challenge_method: "S256",
        prompt: "select_account",
    }).toString();
    return url.toString();
}

/** O cookie do OAuth guarda as três partes; qualquer outra forma é recusada. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const serializeAttempt = (a: OAuthAttempt): string => `${a.state}.${a.verifier}.${a.nonce}`;
export function parseAttempt(value: string | undefined): OAuthAttempt | null {
    const parts = value?.split(".") ?? [];
    if (parts.length !== 3 || !parts.every((p) => TOKEN.test(p))) return null;
    const [state, verifier, nonce] = parts as [string, string, string];
    return { state, verifier, nonce };
}

/** Troca o code pelo id_token. Lança em qualquer resposta inesperada. */
export async function exchangeCode(input: {
    code: string;
    verifier: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}): Promise<string> {
    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            code: input.code,
            code_verifier: input.verifier,
            client_id: input.clientId,
            client_secret: input.clientSecret,
            redirect_uri: input.redirectUri,
        }),
        cache: "no-store",
    });
    if (!response.ok) throw new Error(`token endpoint respondeu ${response.status}`);
    const body: unknown = await response.json();
    const idToken = (body as { id_token?: unknown } | null)?.id_token;
    if (typeof idToken !== "string") throw new Error("resposta sem id_token");
    return idToken;
}

type Jwk = JsonWebKey & { kid?: string };

// as chaves públicas do Google mudam algumas vezes por semana: guarda por 1h e busca de novo se
// aparecer um kid desconhecido
let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 60 * 60 * 1000;

export async function googleKeys(kid: string): Promise<Jwk[]> {
    const fresh = jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS;
    if (fresh && jwksCache!.keys.some((k) => k.kid === kid)) return jwksCache!.keys;
    const response = await fetch(JWKS_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`JWKS respondeu ${response.status}`);
    const keys = ((await response.json()) as { keys?: Jwk[] }).keys;
    if (!Array.isArray(keys)) throw new Error("JWKS sem chaves");
    jwksCache = { keys, fetchedAt: Date.now() };
    return keys;
}

export class InvalidIdToken extends Error {}

function decodeJson(part: string): Record<string, unknown> {
    const value: unknown = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new InvalidIdToken("parte do JWT não é um objeto");
    }
    return value as Record<string, unknown>;
}

/** O kid do cabeçalho, para escolher a chave antes de validar. */
export function idTokenKid(idToken: string): string {
    const kid = decodeJson(idToken.split(".")[0] ?? "").kid;
    if (typeof kid !== "string") throw new InvalidIdToken("sem kid");
    return kid;
}

/**
 * Valida o id_token (OpenID Connect Core §3.1.3.7): assinatura RS256 com a chave do Google, iss,
 * aud, azp, exp, iat, nonce e email_verified. A conta é o `sub`, nunca o e-mail.
 */
export function verifyIdToken(
    idToken: string,
    options: { keys: Jwk[]; clientId: string; nonce: string; now: Date },
): GoogleIdentity {
    const parts = idToken.split(".");
    if (parts.length !== 3) throw new InvalidIdToken("formato");
    const [h, p, s] = parts as [string, string, string];
    let header: Record<string, unknown>;
    let payload: Record<string, unknown>;
    try {
        header = decodeJson(h);
        payload = decodeJson(p);
    } catch {
        throw new InvalidIdToken("JSON inválido");
    }

    // só RS256: nada de "none" nem HS256 com a chave pública como segredo
    if (header.alg !== "RS256") throw new InvalidIdToken("alg");
    const jwk = options.keys.find((k) => k.kid === header.kid && k.kty === "RSA");
    if (!jwk) throw new InvalidIdToken("kid desconhecido");
    const key = createPublicKey({ key: jwk, format: "jwk" });
    if (!verify("RSA-SHA256", Buffer.from(`${h}.${p}`), key, Buffer.from(s, "base64url"))) {
        throw new InvalidIdToken("assinatura");
    }

    const now = Math.floor(options.now.getTime() / 1000);
    if (typeof payload.iss !== "string" || !ISSUERS.has(payload.iss)) {
        throw new InvalidIdToken("iss");
    }
    if (payload.aud !== options.clientId) throw new InvalidIdToken("aud");
    if (payload.azp !== undefined && payload.azp !== options.clientId) {
        throw new InvalidIdToken("azp");
    }
    if (typeof payload.exp !== "number" || payload.exp + CLOCK_SKEW_SECONDS <= now) {
        throw new InvalidIdToken("exp");
    }
    if (typeof payload.iat !== "number" || payload.iat - CLOCK_SKEW_SECONDS > now) {
        throw new InvalidIdToken("iat");
    }
    if (typeof payload.nonce !== "string" || !sameString(payload.nonce, options.nonce)) {
        throw new InvalidIdToken("nonce");
    }
    if (typeof payload.sub !== "string" || payload.sub.length === 0 || payload.sub.length > 255) {
        throw new InvalidIdToken("sub");
    }
    if (typeof payload.email !== "string" || payload.email_verified !== true) {
        throw new InvalidIdToken("email");
    }
    const name = typeof payload.name === "string" ? payload.name.slice(0, 200) : "";
    return { sub: payload.sub, email: payload.email, name };
}
