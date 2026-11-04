## Summary

<!-- What changes and why. Cite the phase of docs/plano-v2.md, e.g. Phase 2. -->

## Security checklist

See [docs/security.md](../docs/security.md). Fill every item; write "none" where nothing applies. An empty checklist blocks review.

- **OWASP 2025 categories touched** (A01–A10, with the rule that covers each):
- **New inputs and their zod schemas** (server actions, route handlers, storage reads):
- **New secrets** (name, where stored, server-only confirmed, no `NEXT_PUBLIC_`):
- **New dependencies** (name, why, audit result):
- **Accepted risks** (also add them to "Accepted risks" in docs/security.md):

## Checks

- [ ] No query params in URLs, no `dangerouslySetInnerHTML`, no console output in production
- [ ] User-facing errors are generic
- [ ] `format:check`, `lint`, `typecheck`, `test`, `build` pass
