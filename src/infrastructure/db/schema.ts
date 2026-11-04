import { sql } from "drizzle-orm";
import {
    char,
    check,
    date,
    doublePrecision,
    index,
    integer,
    pgTable,
    primaryKey,
    smallint,
    text,
    timestamp,
} from "drizzle-orm/pg-core";

// Contas (plano-v2 "Modelo de dados"). A conta é o `google_sub`; o e-mail e o nome só acompanham.
export const users = pgTable(
    "users",
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        googleSub: text("google_sub").notNull().unique(),
        email: text().notNull(),
        name: text().notNull().default(""),
        // o "hoje" de cada usuário é calculado neste fuso
        timeZone: text("time_zone").notNull().default("America/Sao_Paulo"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        check("users_google_sub_check", sql`char_length(${t.googleSub}) between 1 and 255`),
        check("users_email_check", sql`char_length(${t.email}) between 3 and 254`),
        check("users_name_check", sql`char_length(${t.name}) <= 200`),
        check("users_time_zone_check", sql`char_length(${t.timeZone}) between 1 and 64`),
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

// Tarefas (plano-v2 "Modelo de dados"). Avulsa tem `date`; recorrente tem `recurring_days`; nunca
// as duas. Exclusão lógica: `deleted_at` preserva o histórico.
export const tasks = pgTable(
    "tasks",
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        userId: integer("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        text: text().notNull(),
        date: date({ mode: "string" }),
        recurringDays: smallint("recurring_days").array(),
        time: char({ length: 5 }),
        note: text(),
        position: doublePrecision().notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (t) => [
        index("tasks_user_idx")
            .on(t.userId)
            .where(sql`${t.deletedAt} is null`),
        check("tasks_text_check", sql`char_length(${t.text}) between 1 and 300`),
        check("tasks_note_check", sql`char_length(${t.note}) between 1 and 1000`),
        check("tasks_time_check", sql`${t.time} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
        check("tasks_schedule_check", sql`(${t.date} is null) <> (${t.recurringDays} is null)`),
        check(
            "tasks_recurring_days_check",
            sql`cardinality(${t.recurringDays}) between 1 and 7 and ${t.recurringDays} <@ array[0,1,2,3,4,5,6]::smallint[]`,
        ),
    ],
);

// Conclusões por dia: substitui o done_dates do legacy e guarda o histórico das recorrentes.
export const taskCompletions = pgTable(
    "task_completions",
    {
        taskId: integer("task_id")
            .notNull()
            .references(() => tasks.id, { onDelete: "cascade" }),
        date: date({ mode: "string" }).notNull(),
        completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [primaryKey({ columns: [t.taskId, t.date] })],
);
