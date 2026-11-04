# Vecka — Security baseline

Adapted from the Kinne baseline. Every feature is specified, built and reviewed against these rules. A change that breaks a rule is a bug, not a trade-off, unless the exception is recorded in "Accepted risks" (§15) with a reason.

## 1. Principles

- **Deny by default.** Anything not explicitly allowed (route, method, input field, origin, script source) is rejected.
- **Least privilege.** Every credential, database role, workflow and integration gets the minimum access it needs.
- **Never trust the client.** The browser, its storage and every request it sends are attacker-controlled. The server re-checks every rule the UI enforces.
- **Fail closed.** On error, the system denies, shows a generic message and logs the detail server-side only.
- **Minimal surface.** Fewer endpoints, fewer dependencies, fewer secrets, less data stored.
- **Defense in depth.** No single control is relied on.

## 2. Threat model

| Actor                         | Goal                                                                  | Main controls |
| ----------------------------- | --------------------------------------------------------------------- | ------------- |
| Automated scanners and bots   | Find `.env`, `.git`, source maps, admin panels, debug endpoints, CVEs | §3, §4, §10   |
| Another signed-in user        | Read or change someone else's tasks (IDOR)                            | §5, §12       |
| Script against server actions | Forge or flood writes, exhaust the database                           | §5, §7        |
| Caller of the reminder route  | Trigger notifications without the scheduler secret                    | §4, §7        |
| Malicious page or extension   | XSS, clickjacking, CSRF, data theft from storage                      | §6, §8, §9    |
| Leaked credential             | Use a Google, Neon or VAPID secret                                    | §4, §11       |

## 3. Attack surface

- Only routes defined in `src/app` exist. No catch-all route that echoes the requested path.
- No `/api/*` route handlers unless a feature requires one (Google callback, reminder trigger); prefer server actions. Every route handler declares its allowed methods; unsupported methods return 404.
- Unknown paths return the standard 404 page with no detail.
- `public/` contains only static assets meant to be public. Nothing generated from environment variables.
- `poweredByHeader: false`; no source maps in production; no debug, health or admin pages in production.
- `legacy/` is reference material only: it is not served by the app.

## 4. Secrets

- Secrets live only in `.env.local` (gitignored), GitHub Actions secrets and Vercel environment variables. Never in code, commits, issues, PRs, logs, screenshots or chat.
- No secret ever uses the `NEXT_PUBLIC_` prefix.
- Every module that reads a secret or touches the database imports `server-only` (enforced by `src/server-only.test.ts`).
- Environment variables are validated with a strict schema before use; the error names the variable, never its value.
- Preview deployments never receive production credentials.
- On any suspected leak, rotate first and investigate after.
- CI runs secret scanning (gitleaks) on every PR.

## 5. Input validation and authorization

- Every server action and route handler is a public endpoint and is treated as one.
- All input is parsed with a strict zod schema: closed enums, ranges, length caps (task text ≤ 300, note ≤ 1000), `HH:MM` times, weekday arrays of 0–6, unknown keys rejected.
- The `user_id` always comes from the session, never from the client. Every query filters by it; a task that is not the caller's behaves exactly like one that does not exist.
- Past days are read-only on the server too, not only in the UI.
- Database access goes only through Drizzle with bound parameters. No string-built SQL.

## 6. Output, errors and logging

- Users see only generic messages in pt-BR. No stack traces, SQL, table names or library versions.
- No console output in production client bundles.
- Server logs never contain secrets, tokens, push subscription keys, task text or other personal data.
- React escapes output; `dangerouslySetInnerHTML` is forbidden (ESLint `react/no-danger`).

## 7. Abuse and rate limiting

- Writes are rate limited per user; the limiter is portable (Postgres or in-memory), never a vendor-only store.
- The reminder trigger requires a secret compared in constant time, and is idempotent (`reminders_sent`).
- If the limiter cannot answer, the action is refused (fail closed).

## 8. URLs and navigation

- URLs carry only the path. No query parameters for state or tracking (the OAuth callback is the one place that receives the provider's `code` and `state`, and validates them).
- Transient state lives in `sessionStorage` or `history.state`.
- External links use `rel="noopener noreferrer"`.

## 9. Browser storage

- `localStorage`/`sessionStorage` hold only non-sensitive preferences (theme, font size).
- Never tokens, credentials or anything that grants access. The session token lives only in an `HttpOnly` cookie.
- Everything read from storage is untrusted: parsed with a schema; invalid data is discarded.

## 10. HTTP security headers

Applied to every response by `headers()` in `next.config.ts`; the values live in `src/infrastructure/http/security-headers.ts`, shared with its unit test.

- `Content-Security-Policy`: `default-src 'none'`; `script-src 'self' 'unsafe-inline'` (never `'unsafe-eval'` in production); `style-src 'self' 'unsafe-inline'`; `img-src 'self'`; `font-src 'self'` (`next/font` self-hosts the fonts); `connect-src 'self'`; `manifest-src 'self'`; `frame-src 'none'`; `object-src 'none'`; `base-uri 'none'`; `form-action 'self'`; `frame-ancestors 'none'`; `upgrade-insecure-requests`. No `data:` or `blob:`.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy`: camera, microphone, geolocation, payment, USB, serial, MIDI and display-capture off.
- `Cross-Origin-Opener-Policy: same-origin`.

Development adds `'unsafe-eval'` and `ws:`/`wss:` (hot reload) and drops `upgrade-insecure-requests`. Adding Google sign-in (`form-action`/redirects) and Web Push (service worker, push service) will each need their own review of this policy.

## 11. Supply chain and CI/CD

- `package-lock.json` committed; installs use `npm ci`.
- No new dependency without the owner's approval. Planned: `web-push` (phase 5), to confirm then.
- CI runs `npm audit --omit=dev --audit-level=high`, gitleaks, Semgrep and CodeQL.
- Dependabot for npm and GitHub Actions, targeting `develop`.
- GitHub Actions pinned to commit SHAs; each workflow declares minimal `permissions:`.
- `main` and `develop` change only through PRs with green checks.

## 12. Data and privacy

- Collect the minimum: Google `sub`, email and name; tasks, completions and push subscriptions.
- Tasks are soft-deleted (`deleted_at`) so the history stays consistent; a privacy text states retention and how to delete the account before the app opens to other people (LGPD).

## 13. Authentication (Google OAuth 2.0 + PKCE, phase 1)

Implemented by hand, as in Kinne, with only Node `crypto`.

- Authorization Code flow with PKCE (`S256`) and a random `state`, both bound to the browser in a short-lived `__Host-` cookie (`HttpOnly`, `Secure`, `SameSite=Lax`) and checked on the callback.
- The ID token is validated (issuer, audience, expiry, `email_verified`); the account key is `google_sub`, never the email.
- Session cookie `__Host-vecka_session`: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`; random token, only its SHA-256 in `user_sessions`; new token on every sign-in; sliding expiry with an absolute cap; sign-out deletes the session in the database first.
- Every route except `/entrar` and the OAuth routes requires a session.
- Server actions keep Next.js origin checking enabled.

## 14. Verification

- `npm test` covers the header policy, the `server-only` rule and the design tokens.
- Server action schemas get unit tests that reject out-of-range and unknown-key payloads.
- Manual check by the owner before each release to production, following OWASP ASVS level 1.

## 15. Accepted risks

- **`'unsafe-inline'` in `script-src`.** The Next.js runtime writes per-request inline scripts (`self.__next_f.push(...)`); only a per-request nonce would cover them, which forces dynamic rendering of every page. What still blocks: external script hosts, `eval`, `javascript:`/`data:` URLs, plugins, framing, base-tag injection, forms posted elsewhere. Mitigation: §5 and §6 (no `dangerouslySetInnerHTML`, user text always rendered as text). Revisit in phase 6.
