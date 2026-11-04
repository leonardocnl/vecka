// Limite de escritas por usuário, em memória, por instância (security.md §7: portátil, sem
// serviço exclusivo da Vercel).
// ponytail: cada instância conta sozinha; com várias instâncias o teto real é maior. Basta para
// um app de poucos usuários; trocar por Postgres se isso deixar de bastar.
const MAX_KEYS = 10_000;

export class MemoryLimiter {
    private buckets = new Map<string, { tokens: number; at: number }>();

    constructor(
        private readonly capacity: () => number,
        private readonly perSecond: () => number,
        private readonly now = Date.now,
    ) {}

    take(key: string): boolean {
        const now = this.now();
        const capacity = this.capacity();
        const last = this.buckets.get(key);
        const tokens = last
            ? Math.min(capacity, last.tokens + ((now - last.at) / 1000) * this.perSecond())
            : capacity;
        if (tokens < 1) return false;
        // reinsere no fim: o Map fica em ordem de uso e o mais antigo sai primeiro
        this.buckets.delete(key);
        this.buckets.set(key, { tokens: tokens - 1, at: now });
        if (this.buckets.size > MAX_KEYS) this.buckets.delete(this.buckets.keys().next().value!);
        return true;
    }
}
