import { defineConfig } from "drizzle-kit";

// Migrations usam a conexão direta (sem pooler).
process.loadEnvFile(".env.local");

export default defineConfig({
    dialect: "postgresql",
    schema: "./src/infrastructure/db/schema.ts",
    out: "./drizzle",
    dbCredentials: { url: process.env.DATABASE_URL! },
});
