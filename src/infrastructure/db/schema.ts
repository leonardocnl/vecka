import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, char } from "drizzle-orm/pg-core";

// Contas (plano-v2 "Modelo de dados"). A conta é o `google_sub`; o e-mail e o nome só acompanham.
export const users = pgTable(
    "users",
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        googleSub: text("google_sub").notNull().unique(),
        email: text().notNull(),
        name: text().notNull().default(""),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        check("users_google_sub_check", sql`char_length(${t.googleSub}) between 1 and 255`),
        check("users_email_check", sql`char_length(${t.email}) between 3 and 254`),
        check("users_name_check", sql`char_length(${t.name}) <= 200`),
    ],
);

// Sessões no padrão do Kinne: só o SHA-256 do token, expiração por inatividade e teto absoluto.
export const userSessions = pgTable(
    "user_sessions",
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        userId: integer("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        tokenHash: char("token_hash", { length: 64 }).notNull().unique(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        absoluteExpiresAt: timestamp("absolute_expires_at", { withTimezone: true }).notNull(),
    },
    (t) => [
        index("user_sessions_user_idx").on(t.userId),
        index("user_sessions_expires_at_idx").on(t.expiresAt),
        check("user_sessions_token_hash_check", sql`${t.tokenHash} ~ '^[0-9a-f]{64}$'`),
        check("user_sessions_expiry_check", sql`${t.expiresAt} <= ${t.absoluteExpiresAt}`),
    ],
);
