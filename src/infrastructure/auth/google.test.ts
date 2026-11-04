import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
    authorizationUrl,
    idTokenKid,
    InvalidIdToken,
    newOAuthAttempt,
    parseAttempt,
    pkceChallenge,
    serializeAttempt,
    verifyIdToken,
} from "./google";

const CLIENT_ID = "client-123.apps.googleusercontent.com";
const NONCE = "n".repeat(43);
const NOW = new Date("2026-11-03T12:00:00Z");
const nowSec = Math.floor(NOW.getTime() / 1000);

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
const keys = [{ ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" }];

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

function token(
    claims: Record<string, unknown> = {},
    header: Record<string, unknown> = {},
    key = privateKey,
): string {
    const h = b64({ alg: "RS256", kid: "k1", typ: "JWT", ...header });
    const p = b64({
        iss: "https://accounts.google.com",
        aud: CLIENT_ID,
        azp: CLIENT_ID,
        sub: "1234567890",
        email: "leo@example.com",
        email_verified: true,
        name: "Leo",
        nonce: NONCE,
        iat: nowSec - 10,
        exp: nowSec + 3600,
        ...claims,
    });
    return `${h}.${p}.${sign("RSA-SHA256", Buffer.from(`${h}.${p}`), key).toString("base64url")}`;
}

const check = (idToken: string, nonce = NONCE) =>
    verifyIdToken(idToken, { keys, clientId: CLIENT_ID, nonce, now: NOW });

describe("PKCE", () => {
    it("S256 bate com o exemplo da RFC 7636 (apêndice B)", () => {
        expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
        );
    });

    it("cada tentativa tem state, verifier e nonce novos, com 256 bits", () => {
        const a = newOAuthAttempt();
        const b = newOAuthAttempt();
        for (const value of [a.state, a.verifier, a.nonce]) {
            expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
        }
        expect(new Set([a.state, a.verifier, a.nonce, b.state, b.verifier, b.nonce]).size).toBe(6);
    });

    it("a URL pede só openid, email e profile, com S256, state e nonce", () => {
        const attempt = newOAuthAttempt();
        const url = new URL(authorizationUrl(attempt, CLIENT_ID, "http://localhost:3000/cb"));
        expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
        const q = url.searchParams;
        expect(q.get("scope")).toBe("openid email profile");
        expect(q.get("response_type")).toBe("code");
        expect(q.get("code_challenge_method")).toBe("S256");
        expect(q.get("code_challenge")).toBe(pkceChallenge(attempt.verifier));
        expect(q.get("state")).toBe(attempt.state);
        expect(q.get("nonce")).toBe(attempt.nonce);
        // o verifier nunca sai do servidor/cookie
        expect(url.toString()).not.toContain(attempt.verifier);
    });
});

describe("cookie do OAuth (state)", () => {
    it("volta igual depois de serializado", () => {
        const attempt = newOAuthAttempt();
        expect(parseAttempt(serializeAttempt(attempt))).toEqual(attempt);
    });

    it.each([
        ["ausente", undefined],
        ["vazio", ""],
        ["só duas partes", "a".repeat(43) + "." + "b".repeat(43)],
        ["parte curta", "a.b.c"],
        ["caractere estranho", `${"a".repeat(42)}!.${"b".repeat(43)}.${"c".repeat(43)}`],
    ])("recusa cookie %s", (_, value) => {
        expect(parseAttempt(value)).toBeNull();
    });
});

describe("validação do id_token", () => {
    it("aceita um token válido e usa o sub como identidade", () => {
        expect(check(token())).toEqual({
            sub: "1234567890",
            email: "leo@example.com",
            name: "Leo",
        });
        expect(idTokenKid(token())).toBe("k1");
    });

    it("aceita o iss sem https", () => {
        expect(check(token({ iss: "accounts.google.com" })).sub).toBe("1234567890");
    });

    it.each<[string, () => string, string?]>([
        ["assinado por outra chave", () => token({}, {}, other.privateKey)],
        [
            "payload trocado depois de assinado",
            () => {
                const [h, , s] = token().split(".");
                return `${h}.${b64({ sub: "outro", aud: CLIENT_ID })}.${s}`;
            },
        ],
        [
            "alg none",
            () => {
                const [, p] = token().split(".");
                return `${b64({ alg: "none", kid: "k1" })}.${p}.`;
            },
        ],
        ["alg HS256", () => token({}, { alg: "HS256" })],
        ["kid desconhecido", () => token({}, { kid: "k9" })],
        ["iss de outro emissor", () => token({ iss: "https://evil.example.com" })],
        ["aud de outro cliente", () => token({ aud: "outro-cliente" })],
        ["aud em lista", () => token({ aud: [CLIENT_ID, "outro"] })],
        ["azp de outro cliente", () => token({ azp: "outro-cliente" })],
        ["expirado", () => token({ exp: nowSec - 120 })],
        ["sem exp", () => token({ exp: undefined })],
        ["emitido no futuro", () => token({ iat: nowSec + 3600 })],
        ["nonce diferente", () => token({ nonce: "x".repeat(43) })],
        ["sem nonce", () => token({ nonce: undefined })],
        ["e-mail não verificado", () => token({ email_verified: false })],
        ["email_verified como texto", () => token({ email_verified: "true" })],
        ["sem sub", () => token({ sub: "" })],
        ["lixo", () => "isto.nao.e-um-jwt"],
        ["duas partes", () => "a.b"],
    ])("recusa token %s", (_, make) => {
        expect(() => check(make())).toThrow(InvalidIdToken);
    });
});
