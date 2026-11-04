import "server-only";
import { execFileSync } from "node:child_process";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { localDatabaseProblem } from "./local-guard";

// Banco de verdade para os testes de ataque do login (adaptado do Kinne). Liga com VECKA_TEST_DB=1
// e as variáveis PG* de um banco DESCARTÁVEL com as migrations aplicadas (npm run test:db). Sem
// isso, os testes que o usam são pulados.

export const dbTestsEnabled = process.env.VECKA_TEST_DB === "1";

const dialect = new PgDialect();

function literal(value: unknown): string {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return `'${String(value).replaceAll("'", "''")}'`;
}

/** Antes de qualquer comando: o ambiente tem de apontar para esta máquina. */
function psql(text: string): string {
    const problem = localDatabaseProblem();
    if (problem) {
        throw new Error(`Banco recusado: ${problem}. Os testes de banco só rodam localmente.`);
    }
    return execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-qAt", "-c", text], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
    });
}

/** Toda instrução vira "uma linha de JSON com todas as linhas", como o driver HTTP devolve. */
function asJson(text: string): string {
    if (!/^\s*(insert|update|delete)\b/i.test(text)) {
        return `select coalesce(json_agg(t), '[]'::json) from (${text}) t`;
    }
    return /\breturning\b/i.test(text)
        ? `with t as (${text}) select coalesce(json_agg(t), '[]'::json) from t`
        : `${text}; select '[]'::json`;
}

/** SQL direto, para montar cenários e conferir o banco. */
export const admin = (text: string): string => psql(text).trim();

/** Um executor com a mesma forma do Db do Neon, rodando no Postgres local. */
export const localDb = {
    async execute(statement: SQL) {
        const { sql, params } = dialect.sqlToQuery(statement);
        const text = sql.replace(/\$(\d+)/g, (_, n) => literal(params[Number(n) - 1]));
        return { rows: JSON.parse(psql(asJson(text)).trim()) as unknown[] };
    },
};
