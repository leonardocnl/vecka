#!/usr/bin/env bash
# Aplica drizzle/*.sql, em ordem, num PostgreSQL DESCARTÁVEL (testes de banco, npm run test:db).
# Usa as variáveis PG* do ambiente. Recusa qualquer servidor que não seja a própria máquina: nunca
# aponte isto para o banco de develop ou de produção.
set -euo pipefail

# O libpq aceita o destino por várias variáveis; todas têm de apontar para esta máquina (B7):
# PGHOST (sem lista de hosts), PGHOSTADDR, PGSERVICE/PGSERVICEFILE e PGDATABASE como string de conexão.
refuse() { echo "recusado: $1" >&2; exit 1; }
is_local() { case "$1" in "" | localhost | 127.0.0.1 | ::1 | /*) return 0 ;; *) return 1 ;; esac; }
is_local "${PGHOST:-}" || refuse "PGHOST=${PGHOST} não é a máquina local"
case "${PGHOSTADDR:-}" in "" | localhost | 127.0.0.1 | ::1) ;; *) refuse "PGHOSTADDR=${PGHOSTADDR} não é a máquina local" ;; esac
[ -z "${PGSERVICE:-}${PGSERVICEFILE:-}" ] || refuse "PGSERVICE e PGSERVICEFILE podem apontar para outro servidor"
case "${PGDATABASE:-}" in *=* | postgres://* | postgresql://*) refuse "PGDATABASE parece uma string de conexão" ;; esac

cd "$(dirname "$0")/.."
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
for file in drizzle/00*.sql; do
    # o drizzle separa as instruções com este marcador; o psql roda o arquivo inteiro de uma vez
    sed 's/--> statement-breakpoint//' "$file" > "$tmp"
    psql -v ON_ERROR_STOP=1 -q -f "$tmp" > /dev/null
done
echo "migrations aplicadas em ${PGHOST:-o soquete local}"
