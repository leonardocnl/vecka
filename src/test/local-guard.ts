import "server-only";
// A trava dos testes de banco e do script de migrations (revisão B7): eles criam e apagam dados e
// só podem falar com um Postgres desta máquina. O libpq aceita o destino por muitas variáveis
// (PGHOST com lista de hosts, PGHOSTADDR, PGSERVICE, PGDATABASE como string de conexão), então a
// trava olha todas elas. (O endereço de quem responde não serve de prova: o serviço do CI responde
// do IP do contêiner, não de loopback.)

const LOCAL = new Set(["localhost", "127.0.0.1", "::1"]);

/** Por que o ambiente não aponta para um banco local; null se aponta (ou não aponta para nada). */
export function localDatabaseProblem(
    env: Record<string, string | undefined> = process.env,
): string | null {
    const host = env.PGHOST ?? "";
    // um caminho absoluto é um soquete Unix; qualquer outra coisa tem de ser loopback, sem lista
    if (host !== "" && !host.startsWith("/") && !LOCAL.has(host)) {
        return `PGHOST=${host} não é a máquina local`;
    }
    const addr = env.PGHOSTADDR ?? "";
    if (addr !== "" && !LOCAL.has(addr)) return `PGHOSTADDR=${addr} não é a máquina local`;
    if (env.PGSERVICE || env.PGSERVICEFILE) {
        return "PGSERVICE e PGSERVICEFILE podem apontar para outro servidor";
    }
    const database = env.PGDATABASE ?? "";
    if (database.includes("=") || /^postgres(ql)?:/i.test(database)) {
        return "PGDATABASE parece uma string de conexão, que pode trazer outro servidor";
    }
    return null;
}
