import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { localDatabaseProblem } from "./local-guard";

// Revisão B7: os testes de banco e o script de migrations apagam e criam dados. Só rodam contra
// uma máquina local, e nenhuma variável do libpq (PGHOST, PGHOSTADDR, PGSERVICE, PGDATABASE como
// string de conexão) pode mandá-los para outro lugar.
describe("localDatabaseProblem", () => {
    it.each([
        ["nada definido (soquete local)", {}],
        ["localhost", { PGHOST: "localhost" }],
        ["127.0.0.1", { PGHOST: "127.0.0.1" }],
        ["::1", { PGHOST: "::1" }],
        ["soquete Unix", { PGHOST: "/var/run/postgresql" }],
        ["PGHOSTADDR de loopback", { PGHOST: "localhost", PGHOSTADDR: "127.0.0.1" }],
        ["banco com nome simples", { PGHOST: "localhost", PGDATABASE: "vecka" }],
    ])("aceita %s", (_, env) => {
        expect(localDatabaseProblem(env)).toBeNull();
    });

    it.each([
        ["host remoto", { PGHOST: "ep-cool-123.sa-east-1.aws.neon.tech" }],
        ["lista de hosts com um remoto", { PGHOST: "localhost,ep-cool-123.neon.tech" }],
        ["nome que só começa com localhost", { PGHOST: "localhost.evil.example" }],
        ["PGHOSTADDR remoto com PGHOST local", { PGHOST: "localhost", PGHOSTADDR: "10.1.2.3" }],
        ["PGHOSTADDR remoto sem PGHOST", { PGHOSTADDR: "192.0.2.1" }],
        ["PGSERVICE", { PGHOST: "localhost", PGSERVICE: "producao" }],
        ["PGSERVICEFILE", { PGSERVICEFILE: "/tmp/pg_service.conf" }],
        ["PGDATABASE como URI", { PGDATABASE: "postgresql://u:p@ep-x.neon.tech/neondb" }],
        ["PGDATABASE como string de conexão", { PGDATABASE: "host=ep-x.neon.tech dbname=neondb" }],
    ])("recusa %s", (_, env) => {
        expect(localDatabaseProblem(env)).toEqual(expect.stringMatching(/\S/));
    });
});

describe("scripts/apply-migrations-local.sh", () => {
    const run = (env: Record<string, string>) => {
        try {
            execFileSync("scripts/apply-migrations-local.sh", [], {
                env: {
                    NODE_ENV: "test",
                    PATH: process.env.PATH ?? "",
                    PGCONNECT_TIMEOUT: "2",
                    ...env,
                },
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"],
                timeout: 20_000,
            });
            return { code: 0, stderr: "" };
        } catch (e) {
            const error = e as { status: number | null; stderr: string };
            return { code: error.status, stderr: String(error.stderr) };
        }
    };

    it.each([
        ["PGHOST remoto", { PGHOST: "ep-cool-123.neon.tech" }],
        ["PGHOSTADDR remoto com PGHOST local", { PGHOST: "localhost", PGHOSTADDR: "192.0.2.1" }],
        ["PGSERVICE", { PGHOST: "localhost", PGSERVICE: "producao" }],
        ["lista de hosts", { PGHOST: "localhost,ep-x.neon.tech" }],
        ["PGDATABASE como URI", { PGDATABASE: "postgresql://u@ep-x.neon.tech/neondb" }],
    ])("recusa %s antes de abrir qualquer conexão", (_, env) => {
        const result = run(env);
        expect(result.code).toBe(1);
        expect(result.stderr).toMatch(/recusado/);
    });
});
