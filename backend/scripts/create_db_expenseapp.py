"""Crea la base expenseapp si no existe. Usuario/contrasena desde variables de entorno o valores por defecto locales."""
import asyncio
import os
import sys

import asyncpg

USER = os.environ.get("PGUSER", "exp_user_db")
PASSWORD = os.environ.get("PGPASSWORD", "exp_usr2026$")
HOST = os.environ.get("PGHOST", "localhost")
PORT = int(os.environ.get("PGPORT", "5432"))
DBNAME = os.environ.get("PGDATABASE_NEW", "expenseapp")


async def main() -> None:
    dsn = f"postgresql://{USER}:{PASSWORD}@{HOST}:{PORT}/postgres"
    conn = await asyncpg.connect(dsn)
    exists = await conn.fetchval(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        DBNAME,
    )
    if exists:
        print(f"La base {DBNAME} ya existe.")
    else:
        await conn.execute(f'CREATE DATABASE "{DBNAME}"')
        print(f"Base {DBNAME} creada.")
    await conn.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:
        print("Error:", exc, file=sys.stderr)
        sys.exit(1)
