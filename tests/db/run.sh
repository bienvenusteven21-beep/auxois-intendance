#!/usr/bin/env bash
# Teste les migrations et les permissions sur un PostgreSQL local.
# Usage : tests/db/run.sh   (variable PSQL pour adapter la commande psql)
set -euo pipefail
cd "$(dirname "$0")/../.."
PSQL=${PSQL:-psql}
DB=auxois_test
$PSQL -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
run() { $PSQL -q -v ON_ERROR_STOP=1 -d $DB -f "$1" > /dev/null; }
run tests/db/00_supabase_shim.sql
for f in supabase/migrations/*.sql; do echo "→ $f"; run "$f"; done
echo "→ tests"
$PSQL -q -v ON_ERROR_STOP=1 -d $DB -f tests/db/10_permissions_test.sql
