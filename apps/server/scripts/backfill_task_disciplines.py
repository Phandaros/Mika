#!/usr/bin/env python3
"""Preenche disciplinas de tarefas com nomes inequívocos e normaliza aliases conhecidos."""

from __future__ import annotations

import argparse
import re
import sqlite3
import unicodedata
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


DISCIPLINE_ALIASES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("ELE", ("ELE", "ELETRICO", "ELETRICA")),
    ("SPDA", ("SPDA",)),
    ("TEL", ("TEL", "TELECOM", "TELECOMUNICACOES")),
    ("HID", ("HID", "HIDRAULICO", "HIDRAULICA")),
    ("SAN", ("SAN", "SANITARIO", "SANITARIA")),
    ("PPCI", ("PPCI", "PCI", "PREVENTIVO")),
    ("SPK", ("SPK", "SPRINKLER")),
    ("AUT", ("AUT", "AUTOMACAO")),
    ("GÁS", ("GAS",)),
    ("CLI", ("CLI", "HVAC", "CLIMATIZACAO", "CLIMA")),
    ("FUR", ("FUR", "FURACOES")),
    ("COORD", ("COORD", "COORDENACAO")),
    ("EP", ("EP", "ESTUDO PRELIMINAR")),
)

EXISTING_ALIAS_NORMALIZATION = {
    "PCI": "PPCI",
    "AUTOMACAO": "AUT",
    "REVISAO": "Revisão",
    "HVAC": "CLI",
}


@dataclass(frozen=True)
class TaskChange:
    task_id: str
    previous: str | None
    discipline: str
    reason: str


def normalize_for_match(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.upper())
    without_accents = "".join(character for character in decomposed if unicodedata.category(character) != "Mn")
    return re.sub(r"\s+", " ", without_accents).strip()


def begins_with_alias(value: str, alias: str) -> bool:
    if not value.startswith(alias):
        return False
    if len(value) == len(alias):
        return True
    return bool(re.match(r"[\s\-:/]", value[len(alias)]))


def strip_leading_project_markers(value: str) -> str:
    remaining = value
    marker_pattern = re.compile(r"^\s*\[[^\]]+\]\s*(?:[-:]\s*)?")
    while match := marker_pattern.match(remaining):
        remaining = remaining[match.end() :]
    return remaining.strip()


def infer_task_discipline(title: str) -> str | None:
    normalized_title = normalize_for_match(title)
    if not normalized_title:
        return None
    if re.match(r"^\{\s*R\s*\}(?:\s*[-:]\s*)?", normalized_title):
        return "Revisão"

    candidate = strip_leading_project_markers(normalized_title)
    for discipline, aliases in DISCIPLINE_ALIASES:
        if any(begins_with_alias(candidate, alias) for alias in aliases):
            return discipline
    return None


def normalized_existing_discipline(value: str) -> str | None:
    return EXISTING_ALIAS_NORMALIZATION.get(normalize_for_match(value))


def collect_changes(connection: sqlite3.Connection) -> tuple[list[TaskChange], int]:
    rows = connection.execute(
        """
        SELECT id, name, discipline
        FROM Task
        WHERE deletedAt IS NULL
        ORDER BY id
        """
    ).fetchall()

    missing_before = 0
    changes: list[TaskChange] = []
    for task_id, name, discipline in rows:
        if discipline is None or not discipline.strip():
            missing_before += 1
            inferred = infer_task_discipline(name or "")
            if inferred:
                changes.append(TaskChange(task_id, discipline, inferred, "inferida pelo título"))
            continue

        normalized = normalized_existing_discipline(discipline)
        if normalized and normalized != discipline:
            changes.append(TaskChange(task_id, discipline, normalized, "alias normalizado"))

    return changes, missing_before


def create_backup(source: sqlite3.Connection, database_path: Path) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = database_path.with_name(f"{database_path.stem}.before-task-discipline-backfill.{timestamp}.db")
    with sqlite3.connect(backup_path) as destination:
        source.backup(destination)
    return backup_path


def print_summary(
    *,
    database_path: Path,
    apply_changes: bool,
    changes: list[TaskChange],
    missing_before: int,
    backup_path: Path | None,
) -> None:
    inferred = [change for change in changes if change.reason == "inferida pelo título"]
    normalized = [change for change in changes if change.reason == "alias normalizado"]
    inferred_counts = Counter(change.discipline for change in inferred)
    normalization_counts = Counter(f"{change.previous} -> {change.discipline}" for change in normalized)

    print(f"Modo: {'APLICAÇÃO' if apply_changes else 'DRY-RUN'}")
    print(f"Banco: {database_path}")
    if backup_path:
        print(f"Backup: {backup_path}")
    print(f"Tarefas ativas sem disciplina antes: {missing_before}")
    print(f"Disciplinas inferidas: {len(inferred)}")
    for discipline, count in inferred_counts.items():
        print(f"  {discipline}: {count}")
    print(f"Aliases existentes normalizados: {len(normalized)}")
    for alias, count in normalization_counts.items():
        print(f"  {alias}: {count}")
    print(f"Tarefas que permanecerão sem disciplina: {missing_before - len(inferred)}")
    if not apply_changes:
        print("Nenhuma alteração foi gravada. Use --apply para executar após revisar este resumo.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--server-dir", default=".", help="Diretório apps/server (padrão: diretório atual)")
    parser.add_argument("--db-path", help="Caminho explícito do SQLite; substitui --server-dir/data/mk-projetos.db")
    parser.add_argument("--apply", action="store_true", help="Cria backup e grava as alterações")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    server_dir = Path(args.server_dir).resolve()
    database_path = Path(args.db_path).resolve() if args.db_path else server_dir / "data" / "mk-projetos.db"
    if not database_path.is_file():
        raise SystemExit(f"Banco não encontrado: {database_path}")

    connection = sqlite3.connect(database_path, timeout=30)
    connection.execute("PRAGMA busy_timeout = 30000")
    try:
        changes, missing_before = collect_changes(connection)
        backup_path: Path | None = None
        if args.apply and changes:
            backup_path = create_backup(connection, database_path)
            connection.execute("BEGIN IMMEDIATE")
            try:
                connection.executemany(
                    "UPDATE Task SET discipline = ? WHERE id = ?",
                    [(change.discipline, change.task_id) for change in changes],
                )
                connection.commit()
            except Exception:
                connection.rollback()
                raise

        print_summary(
            database_path=database_path,
            apply_changes=args.apply,
            changes=changes,
            missing_before=missing_before,
            backup_path=backup_path,
        )
    finally:
        connection.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
