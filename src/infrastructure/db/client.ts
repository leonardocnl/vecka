import "server-only";
import { drizzle } from "drizzle-orm/neon-http";

// O app usa a conexão pelo pooler; a direta é só para migrations.
export function createDb(url = process.env.DATABASE_URL_POOLED) {
    if (!url) throw new Error("DATABASE_URL_POOLED não definida");
    return drizzle(url);
}

export type Db = ReturnType<typeof createDb>;
