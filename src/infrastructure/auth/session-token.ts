import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** O token do cookie de sessão: 32 bytes aleatórios. */
export const newSessionToken = (): string => randomBytes(32).toString("base64url");

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const isSessionToken = (value: unknown): value is string =>
    typeof value === "string" && TOKEN.test(value);

/** No banco entra só o SHA-256 do token; o token em si nunca. */
export const hashSessionToken = (token: string): string =>
    createHash("sha256").update(token).digest("hex");
