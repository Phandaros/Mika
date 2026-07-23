#!/usr/bin/env python3
"""Importa feriados nacionais e pontos facultativos integrais no SQLite do Mika.

Uso, a partir da raiz do monorepo:
  pnpm db:import-brazil-holidays -- --year 2026
  pnpm db:import-brazil-holidays -- --year 2026 --apply

Sem ``--apply`` o comando apenas exibe uma prévia. O catálogo é versionado por
ano para que alterações legais sejam revisadas antes de chegar ao banco.
"""

from __future__ import annotations

import argparse
import os
import sqlite3
import sys
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path


@dataclass(frozen=True)
class Holiday:
    date: str
    name: str


SOURCES_BY_YEAR: dict[int, str] = {
    2026: "Portaria MGI nº 11.460, de 29 de dezembro de 2025",
}

HOLIDAYS_BY_YEAR: dict[int, tuple[Holiday, ...]] = {
    2026: (
        Holiday("2026-01-01", "Confraternização Universal"),
        Holiday("2026-02-16", "Carnaval"),
        Holiday("2026-02-17", "Carnaval"),
        Holiday("2026-04-03", "Paixão de Cristo"),
        Holiday("2026-04-20", "Ponto facultativo"),
        Holiday("2026-04-21", "Tiradentes"),
        Holiday("2026-05-01", "Dia Mundial do Trabalho"),
        Holiday("2026-06-04", "Corpus Christi"),
        Holiday("2026-06-05", "Ponto facultativo"),
        Holiday("2026-09-07", "Independência do Brasil"),
        Holiday("2026-10-12", "Nossa Senhora Aparecida"),
        Holiday("2026-11-02", "Finados"),
        Holiday("2026-11-15", "Proclamação da República"),
        Holiday("2026-11-20", "Dia Nacional de Zumbi e da Consciência Negra"),
        Holiday("2026-12-25", "Natal"),
    ),
}

REQUIRED_COLUMNS = {"id", "date", "name", "createdBy", "createdAt", "updatedAt"}


def configure_console_encoding() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def new_id() -> str:
    # Prisma aceita qualquer String em campos @id String; não precisa ser CUID.
    return uuid.uuid4().hex


def parse_env_file(env_path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not env_path.exists():
        return values

    for raw in env_path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")

    return values


def resolve_db_path(server_dir: Path, explicit_db: str | None) -> Path:
    if explicit_db:
        return Path(explicit_db).expanduser().resolve()

    env = parse_env_file(server_dir / ".env")
    db_url = env.get("DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not db_url:
        raise SystemExit("DATABASE_URL não encontrada. Passe --db ou configure apps/server/.env")
    if not db_url.startswith("file:"):
        raise SystemExit(f"Este script só suporta SQLite file:. DATABASE_URL atual: {db_url}")

    db_path = Path(db_url.removeprefix("file:"))
    if db_path.is_absolute():
        return db_path

    server_relative = (server_dir / db_path).resolve()
    if server_relative.exists():
        return server_relative

    return (server_dir / "prisma" / db_path).resolve()


def validate_catalog(year: int, holidays: tuple[Holiday, ...]) -> None:
    dates = [holiday.date for holiday in holidays]
    if len(dates) != len(set(dates)):
        raise SystemExit(f"O catálogo de {year} contém datas duplicadas")

    for holiday in holidays:
        try:
            parsed_date = date.fromisoformat(holiday.date)
        except ValueError as error:
            raise SystemExit(f"Data inválida no catálogo de {year}: {holiday.date}") from error
        if parsed_date.year != year:
            raise SystemExit(f"Data fora do ano {year}: {holiday.date}")
        if not holiday.name.strip():
            raise SystemExit(f"Feriado sem nome no catálogo de {year}: {holiday.date}")


def validate_schema(conn: sqlite3.Connection) -> None:
    table = conn.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'CompanyHoliday'"
    ).fetchone()
    if table is None:
        raise SystemExit("Tabela CompanyHoliday não encontrada. Execute as migrations do servidor antes da importação")

    columns = {row[1] for row in conn.execute('PRAGMA table_info("CompanyHoliday")').fetchall()}
    missing = sorted(REQUIRED_COLUMNS - columns)
    if missing:
        raise SystemExit(f"Tabela CompanyHoliday incompatível. Colunas ausentes: {', '.join(missing)}")


def load_existing(conn: sqlite3.Connection, holidays: tuple[Holiday, ...]) -> dict[str, str]:
    placeholders = ", ".join("?" for _ in holidays)
    rows = conn.execute(
        f'SELECT "date", "name" FROM "CompanyHoliday" WHERE "date" IN ({placeholders})',
        [holiday.date for holiday in holidays],
    ).fetchall()
    return {row[0]: row[1] for row in rows}


def print_preview(holidays: tuple[Holiday, ...], existing: dict[str, str]) -> list[Holiday]:
    pending: list[Holiday] = []
    for holiday in holidays:
        existing_name = existing.get(holiday.date)
        if existing_name is None:
            pending.append(holiday)
            print(f"[novo]      {holiday.date} | {holiday.name}")
        elif existing_name == holiday.name:
            print(f"[existente] {holiday.date} | {existing_name}")
        else:
            print(
                f"[conflito]  {holiday.date} | banco: {existing_name} | catálogo: {holiday.name}"
            )

    return pending


def insert_holidays(conn: sqlite3.Connection, holidays: list[Holiday]) -> int:
    timestamp = now_iso()
    inserted = 0
    for holiday in holidays:
        cursor = conn.execute(
            """
            INSERT INTO "CompanyHoliday" (
                "id", "date", "name", "createdBy", "createdAt", "updatedAt"
            ) VALUES (?, ?, ?, NULL, ?, ?)
            ON CONFLICT("date") DO NOTHING
            """,
            (new_id(), holiday.date, holiday.name, timestamp, timestamp),
        )
        inserted += cursor.rowcount

    return inserted


def main() -> int:
    configure_console_encoding()
    parser = argparse.ArgumentParser(
        description="Importa feriados nacionais e pontos facultativos integrais no SQLite do Mika."
    )
    parser.add_argument("--year", type=int, default=date.today().year, help="Ano do catálogo oficial")
    parser.add_argument("--server-dir", default=".", help="Pasta apps/server. Padrão: diretório atual")
    parser.add_argument(
        "--db",
        default=None,
        help="Caminho explícito do SQLite. Se omitido, lê DATABASE_URL do .env",
    )
    parser.add_argument("--apply", action="store_true", help="Grava as datas; sem esta opção, exibe apenas a prévia")
    args = parser.parse_args()

    holidays = HOLIDAYS_BY_YEAR.get(args.year)
    source = SOURCES_BY_YEAR.get(args.year)
    if holidays is None or source is None:
        supported = ", ".join(str(year) for year in sorted(HOLIDAYS_BY_YEAR))
        raise SystemExit(f"Ano {args.year} ainda não possui catálogo oficial. Anos disponíveis: {supported}")

    validate_catalog(args.year, holidays)
    server_dir = Path(args.server_dir).resolve()
    db_path = resolve_db_path(server_dir, args.db)
    if not db_path.exists():
        raise SystemExit(f"Banco SQLite não encontrado: {db_path}")

    mode = "APLICAÇÃO" if args.apply else "PRÉVIA"
    print(f"[info] Modo:    {mode}")
    print(f"[info] Ano:     {args.year}")
    print(f"[info] Fonte:   {source}")
    print(f"[info] SQLite:  {db_path}")
    print()

    with sqlite3.connect(db_path, timeout=10, isolation_level=None) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA busy_timeout = 10000")
        validate_schema(conn)

        transaction_started = False
        try:
            if args.apply:
                conn.execute("BEGIN IMMEDIATE")
                transaction_started = True

            existing = load_existing(conn, holidays)
            pending = print_preview(holidays, existing)
            inserted = 0

            if args.apply:
                inserted = insert_holidays(conn, pending)
                conn.commit()
                transaction_started = False

            print()
            print("Resumo:")
            print(f"  Catálogo:   {len(holidays)}")
            print(f"  Existentes: {len(existing)}")
            print(f"  Novos:      {len(pending)}")
            print(f"  Inseridos:  {inserted}")
            if not args.apply and pending:
                print("\n[info] Prévia concluída. Execute novamente com --apply para gravar.")
            elif args.apply:
                print("\n[ok] Importação concluída.")
        except BaseException:
            if transaction_started:
                conn.rollback()
            raise

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
