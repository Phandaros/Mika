#!/usr/bin/env python3
"""
Importa dumps JSON do Asana para o SQLite usado pelo Prisma.

Uso recomendado, a partir de apps/server:
  python scripts/import_asana_json.py --json-dir ./asana-export --clear

O script procura DATABASE_URL no .env. Para SQLite, aceita URLs tipo:
  DATABASE_URL="file:../data/mk-projetos.db"

Observação sobre senha:
  Por padrão, grava passwordHash="mk123" para todos os usuários importados.
  Se seu backend usa bcrypt/argon/etc., gere o hash com o mesmo algoritmo do app e passe:
  python scripts/import_asana_json.py --json-dir ./asana-export --password-hash "<HASH>"
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import sys
import uuid
from pathlib import Path
from typing import Any, Iterable

DEFAULT_PASSWORD_HASH = "mk123"
IMPORT_USERS = False


def now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


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
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        values[key] = value
    return values


def resolve_db_path(server_dir: Path, explicit_db: str | None) -> Path:
    if explicit_db:
        return Path(explicit_db).expanduser().resolve()

    env = parse_env_file(server_dir / ".env")
    db_url = env.get("DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not db_url:
        raise SystemExit("DATABASE_URL não encontrada. Passe --db ou crie apps/server/.env")

    if not db_url.startswith("file:"):
        raise SystemExit(f"Este script só suporta SQLite file:. DATABASE_URL atual: {db_url}")

    file_part = db_url.removeprefix("file:")
    db_path = Path(file_part)
    if db_path.is_absolute():
        return db_path

    # No app atual o adapter better-sqlite3 resolve a URL relativa a apps/server.
    # Mantemos fallback para a regra antiga do Prisma relativa ao schema.
    server_relative = (server_dir / db_path).resolve()
    if server_relative.exists():
        return server_relative

    schema_dir = server_dir / "prisma"
    return (schema_dir / db_path).resolve()


def load_json_file(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as f:
        return json.load(f)


def find_files(json_dir: Path, pattern: str) -> list[Path]:
    # Case-insensitive; aceita nomes como projects(1).json.
    rx = re.compile(pattern, re.IGNORECASE)
    return sorted([p for p in json_dir.glob("*.json") if rx.search(p.name)])


def load_list(json_dir: Path, pattern: str) -> list[dict[str, Any]]:
    paths = find_files(json_dir, pattern)
    if not paths:
        print(f"[aviso] Arquivo não encontrado para padrão: {pattern}")
        return []

    records: list[dict[str, Any]] = []
    for path in paths:
        data = load_json_file(path)
        if isinstance(data, dict) and "data" in data and isinstance(data["data"], list):
            data = data["data"]
        if not isinstance(data, list):
            print(f"[aviso] Ignorando {path.name}: esperado JSON array")
            continue
        records.extend(x for x in data if isinstance(x, dict))

    label = paths[0].name if len(paths) == 1 else f"{len(paths)} arquivos"
    print(f"[ok] {label}: {len(records)} registros")
    return records


def q(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({q(table)})").fetchall()
    return {row[1] for row in rows}


def insert_or_update(conn: sqlite3.Connection, table: str, unique_cols: list[str], data: dict[str, Any]) -> None:
    cols_available = table_columns(conn, table)
    data = {k: v for k, v in data.items() if k in cols_available}
    if not data:
        return
    cols = list(data.keys())
    placeholders = ", ".join(["?"] * len(cols))
    col_sql = ", ".join(q(c) for c in cols)
    conflict_sql = ", ".join(q(c) for c in unique_cols)
    update_cols = [c for c in cols if c not in unique_cols and c != "id"]
    if update_cols:
        update_sql = ", ".join(f"{q(c)} = excluded.{q(c)}" for c in update_cols)
        sql = f"INSERT INTO {q(table)} ({col_sql}) VALUES ({placeholders}) ON CONFLICT ({conflict_sql}) DO UPDATE SET {update_sql}"
    else:
        sql = f"INSERT INTO {q(table)} ({col_sql}) VALUES ({placeholders}) ON CONFLICT ({conflict_sql}) DO NOTHING"
    conn.execute(sql, [data[c] for c in cols])


def get_id_by(conn: sqlite3.Connection, table: str, column: str, value: Any) -> str | None:
    if value is None:
        return None
    row = conn.execute(f"SELECT id FROM {q(table)} WHERE {q(column)} = ? LIMIT 1", (value,)).fetchone()
    return row[0] if row else None


def exists_by(conn: sqlite3.Connection, table: str, column: str, value: Any) -> bool:
    return get_id_by(conn, table, column, value) is not None


def boolv(value: Any, default: bool = False) -> int:
    if value is None:
        return int(default)
    return int(bool(value))


def asana_ref_gid(obj: Any) -> str | None:
    return obj.get("gid") if isinstance(obj, dict) else None


def asana_ref_name(obj: Any) -> str | None:
    return obj.get("name") if isinstance(obj, dict) else None


def ensure_user(conn: sqlite3.Connection, ref: dict[str, Any] | None, password_hash: str) -> None:
    if not IMPORT_USERS:
        return

    if not isinstance(ref, dict) or not ref.get("gid"):
        return
    gid = str(ref["gid"])
    email = ref.get("email") or f"asana-{gid}@local.invalid"
    name = ref.get("name") or email
    photo = ref.get("photo") if isinstance(ref.get("photo"), dict) else {}
    insert_or_update(conn, "User", ["asanaGid"], {
        "id": new_id(),
        "asanaGid": gid,
        "email": email,
        "name": name,
        "passwordHash": password_hash,
        "role": "MEMBER",
        "isActive": 1,
        "photo21x21": photo.get("image_21x21"),
        "photo27x27": photo.get("image_27x27"),
        "photo36x36": photo.get("image_36x36"),
        "photo60x60": photo.get("image_60x60"),
        "photo128x128": photo.get("image_128x128"),
        "photoOriginal": photo.get("image_1024x1024") or photo.get("image_128x128"),
        "createdAt": now_iso(),
        "updatedAt": now_iso(),
    })


def clear_asana_tables(conn: sqlite3.Connection) -> None:
    # Ordem respeitando FKs.
    tables = [
        "TaskCustomFieldValue", "TaskTag", "TaskLike", "TaskFollower", "TaskMembership",
        "ProjectCustomFieldSetting", "AsanaCustomFieldEnumOption", "AsanaCustomField",
        "ProjectMember", "ProjectFollower", "Tag", "Section", "Task", "Project", "Team", "AsanaWorkspace",
    ]
    conn.execute("PRAGMA foreign_keys = OFF")
    for table in tables:
        try:
            conn.execute(f"DELETE FROM {q(table)}")
        except sqlite3.OperationalError:
            pass
    conn.execute("PRAGMA foreign_keys = ON")


def import_workspaces(conn: sqlite3.Connection, workspaces: list[dict[str, Any]]) -> None:
    for w in workspaces:
        gid = str(w.get("gid")) if w.get("gid") else None
        if not gid:
            continue
        insert_or_update(conn, "AsanaWorkspace", ["asanaGid"], {
            "id": new_id(),
            "asanaGid": gid,
            "resourceType": w.get("resource_type"),
            "name": w.get("name") or gid,
            "createdAt": now_iso(),
            "updatedAt": now_iso(),
        })


def import_teams(conn: sqlite3.Connection, teams: list[dict[str, Any]], default_workspace_gid: str | None) -> None:
    for t in teams:
        gid = str(t.get("gid")) if t.get("gid") else None
        if not gid:
            continue
        insert_or_update(conn, "Team", ["asanaGid"], {
            "id": new_id(),
            "asanaGid": gid,
            "name": t.get("name") or gid,
            "description": t.get("description"),
            "workspaceGid": asana_ref_gid(t.get("workspace")) or default_workspace_gid,
            "createdAt": now_iso(),
            "updatedAt": now_iso(),
        })


def import_users(conn: sqlite3.Connection, users: Iterable[dict[str, Any]], password_hash: str) -> None:
    if not IMPORT_USERS:
        print("[info] Pulando usuários (--import-users não foi informado).")
        return

    for u in users:
        ensure_user(conn, u, password_hash)


def import_projects(conn: sqlite3.Connection, projects: list[dict[str, Any]], password_hash: str) -> None:
    for p in projects:
        gid = str(p.get("gid")) if p.get("gid") else None
        workspace_gid = asana_ref_gid(p.get("workspace"))
        if not gid or not workspace_gid:
            continue
        ensure_user(conn, p.get("owner"), password_hash)
        for u in p.get("followers") or []:
            ensure_user(conn, u, password_hash)
        for u in p.get("members") or []:
            ensure_user(conn, u, password_hash)

        status = p.get("current_status") if isinstance(p.get("current_status"), dict) else {}
        insert_or_update(conn, "Project", ["asanaGid"], {
            "id": new_id(),
            "asanaGid": gid,
            "name": p.get("name") or gid,
            "notes": p.get("notes"),
            "htmlNotes": p.get("html_notes"),
            "permalinkUrl": p.get("permalink_url"),
            "archived": boolv(p.get("archived")),
            "color": p.get("color"),
            "public": boolv(p.get("public")),
            "defaultView": p.get("default_view"),
            "currentStatusGid": status.get("gid"),
            "currentStatusColor": status.get("color"),
            "currentStatusText": status.get("text"),
            "statusUpdateGid": asana_ref_gid(p.get("current_status_update")),
            "startOn": p.get("start_on"),
            "dueOn": p.get("due_on"),
            "dueDate": p.get("due_date"),
            "asanaCreatedAt": p.get("created_at"),
            "asanaModifiedAt": p.get("modified_at"),
            "ownerGid": asana_ref_gid(p.get("owner")),
            "teamGid": asana_ref_gid(p.get("team")),
            "workspaceGid": workspace_gid,
            "createdAt": now_iso(),
            "updatedAt": now_iso(),
        })
        project_id = get_id_by(conn, "Project", "asanaGid", gid)
        if project_id:
            for u in p.get("followers") or []:
                ugid = asana_ref_gid(u)
                if ugid and exists_by(conn, "User", "asanaGid", ugid):
                    insert_or_update(conn, "ProjectFollower", ["projectId", "userGid"], {"id": new_id(), "projectId": project_id, "userGid": ugid})
            for u in p.get("members") or []:
                ugid = asana_ref_gid(u)
                if ugid and exists_by(conn, "User", "asanaGid", ugid):
                    insert_or_update(conn, "ProjectMember", ["projectId", "userGid"], {"id": new_id(), "projectId": project_id, "userGid": ugid})


def import_sections(conn: sqlite3.Connection, sections: list[dict[str, Any]]) -> None:
    for s in sections:
        gid = str(s.get("gid")) if s.get("gid") else None
        project_gid = asana_ref_gid(s.get("project"))
        if not gid or not project_gid:
            continue
        insert_or_update(conn, "Section", ["asanaGid"], {
            "id": new_id(),
            "asanaGid": gid,
            "name": s.get("name") or gid,
            "projectGid": project_gid,
            "asanaCreatedAt": s.get("created_at"),
            "createdAt": now_iso(),
            "updatedAt": now_iso(),
        })


def import_tags(conn: sqlite3.Connection, tags: list[dict[str, Any]]) -> None:
    for t in tags:
        gid = str(t.get("gid")) if t.get("gid") else None
        if not gid:
            continue
        insert_or_update(conn, "Tag", ["asanaGid"], {
            "id": new_id(),
            "asanaGid": gid,
            "name": t.get("name") or gid,
            "color": t.get("color"),
            "asanaCreatedAt": t.get("created_at"),
            "createdAt": now_iso(),
            "updatedAt": now_iso(),
        })


def import_custom_fields(conn: sqlite3.Connection, settings: list[dict[str, Any]], password_hash: str) -> None:
    for setting in settings:
        cf = setting.get("custom_field") if isinstance(setting.get("custom_field"), dict) else None
        project_gid = asana_ref_gid(setting.get("project"))
        if not cf or not cf.get("gid"):
            continue
        ensure_user(conn, cf.get("created_by"), password_hash)
        cf_gid = str(cf["gid"])
        insert_or_update(conn, "AsanaCustomField", ["asanaGid"], {
            "id": new_id(),
            "asanaGid": cf_gid,
            "name": cf.get("name") or cf_gid,
            "description": cf.get("description"),
            "type": cf.get("type") or "unknown",
            "precision": cf.get("precision"),
            "format": cf.get("format"),
            "currencyCode": cf.get("currency_code"),
            "isGlobalToWorkspace": boolv(cf.get("is_global_to_workspace")),
            "createdByGid": asana_ref_gid(cf.get("created_by")),
            "createdAt": now_iso(),
            "updatedAt": now_iso(),
        })
        cf_id = get_id_by(conn, "AsanaCustomField", "asanaGid", cf_gid)
        for idx, option in enumerate(cf.get("enum_options") or []):
            ogid = option.get("gid")
            if ogid and cf_id:
                insert_or_update(conn, "AsanaCustomFieldEnumOption", ["asanaGid"], {
                    "id": new_id(),
                    "asanaGid": str(ogid),
                    "customFieldId": cf_id,
                    "name": option.get("name") or str(ogid),
                    "color": option.get("color"),
                    "enabled": boolv(option.get("enabled"), True),
                    "sortOrder": idx,
                })
        project_id = get_id_by(conn, "Project", "asanaGid", project_gid) if project_gid else None
        if project_id and cf_id and setting.get("gid"):
            insert_or_update(conn, "ProjectCustomFieldSetting", ["asanaGid"], {
                "id": new_id(),
                "asanaGid": str(setting["gid"]),
                "projectId": project_id,
                "customFieldId": cf_id,
                "isImportant": boolv(setting.get("is_important")),
            })


def all_task_records(tasks: list[dict[str, Any]], subtasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_gid: dict[str, dict[str, Any]] = {}
    for t in tasks + subtasks:
        gid = t.get("gid")
        if gid:
            by_gid[str(gid)] = t
        for st in t.get("subtasks") or []:
            # Algumas respostas podem trazer subtasks resumidas. Só importa se houver nome suficiente.
            if isinstance(st, dict) and st.get("gid") and st.get("name"):
                by_gid.setdefault(str(st["gid"]), st)
    return list(by_gid.values())


def import_tasks_base(conn: sqlite3.Connection, task_records: list[dict[str, Any]], password_hash: str) -> None:
    for t in task_records:
        gid = str(t.get("gid")) if t.get("gid") else None
        if not gid:
            continue
        ensure_user(conn, t.get("assignee"), password_hash)
        for u in t.get("followers") or []:
            ensure_user(conn, u, password_hash)
        for u in t.get("likes") or []:
            ensure_user(conn, u, password_hash)
        parent = t.get("parent") if isinstance(t.get("parent"), dict) else None
        insert_or_update(conn, "Task", ["asanaGid"], {
            "id": new_id(),
            "asanaGid": gid,
            "name": t.get("name") or gid,
            "notes": t.get("notes"),
            "htmlNotes": t.get("html_notes"),
            "resourceType": t.get("resource_type"),
            "assigneeStatus": t.get("assignee_status"),
            "completed": boolv(t.get("completed")),
            "liked": boolv(t.get("liked")),
            "numLikes": int(t.get("num_likes") or 0),
            "numSubtasks": int(t.get("num_subtasks") or 0),
            "dueAt": t.get("due_at"),
            "completedAtAsana": t.get("completed_at"),
            "asanaCreatedAt": t.get("created_at"),
            "asanaModifiedAt": t.get("modified_at"),
            "dueOn": t.get("due_on"),
            "startOn": t.get("start_on"),
            "assigneeGid": asana_ref_gid(t.get("assignee")),
            "parentAsanaGid": asana_ref_gid(parent),
            "parentName": asana_ref_name(parent),
            "createdAt": now_iso(),
            "updatedAt": now_iso(),
        })


def resolve_task_parents(conn: sqlite3.Connection) -> None:
    rows = conn.execute('SELECT id, "parentAsanaGid" FROM "Task" WHERE "parentAsanaGid" IS NOT NULL').fetchall()
    for task_id, parent_gid in rows:
        parent_id = get_id_by(conn, "Task", "asanaGid", parent_gid)
        if parent_id and parent_id != task_id:
            conn.execute('UPDATE "Task" SET "parentId" = ?, "updatedAt" = ? WHERE id = ?', (parent_id, now_iso(), task_id))


def import_task_relations(conn: sqlite3.Connection, task_records: list[dict[str, Any]]) -> None:
    for t in task_records:
        gid = str(t.get("gid")) if t.get("gid") else None
        task_id = get_id_by(conn, "Task", "asanaGid", gid)
        if not task_id:
            continue

        # Reimportar deve ser idempotente mesmo quando chaves únicas têm NULL
        # (SQLite permite duplicatas nesses casos).
        for table in ["TaskMembership", "TaskFollower", "TaskLike", "TaskTag", "TaskCustomFieldValue"]:
            conn.execute(f"DELETE FROM {q(table)} WHERE taskId = ?", (task_id,))

        for m in t.get("memberships") or []:
            project = m.get("project") if isinstance(m.get("project"), dict) else {}
            section = m.get("section") if isinstance(m.get("section"), dict) else {}
            insert_or_update(conn, "TaskMembership", ["taskId", "projectGid", "sectionGid"], {
                "id": new_id(),
                "taskId": task_id,
                "projectGid": project.get("gid"),
                "projectName": project.get("name"),
                "sectionGid": section.get("gid"),
                "sectionName": section.get("name"),
            })

        for u in t.get("followers") or []:
            ugid = asana_ref_gid(u)
            if ugid and exists_by(conn, "User", "asanaGid", ugid):
                insert_or_update(conn, "TaskFollower", ["taskId", "userGid"], {"id": new_id(), "taskId": task_id, "userGid": ugid})

        for u in t.get("likes") or []:
            ugid = asana_ref_gid(u)
            if ugid and exists_by(conn, "User", "asanaGid", ugid):
                insert_or_update(conn, "TaskLike", ["taskId", "userGid"], {"id": new_id(), "taskId": task_id, "userGid": ugid})

        for tag in t.get("tags") or []:
            tag_gid = asana_ref_gid(tag)
            if tag_gid and exists_by(conn, "Tag", "asanaGid", tag_gid):
                insert_or_update(conn, "TaskTag", ["taskId", "tagGid"], {"id": new_id(), "taskId": task_id, "tagGid": tag_gid})

        for cf in t.get("custom_fields") or []:
            cf_gid = cf.get("gid")
            if not cf_gid:
                continue
            cf_id = get_id_by(conn, "AsanaCustomField", "asanaGid", cf_gid)
            enum_value = cf.get("enum_value") if isinstance(cf.get("enum_value"), dict) else None
            enum_gid = enum_value.get("gid") if enum_value else None
            enum_id = get_id_by(conn, "AsanaCustomFieldEnumOption", "asanaGid", enum_gid) if enum_gid else None
            insert_or_update(conn, "TaskCustomFieldValue", ["taskId", "customFieldGid"], {
                "id": new_id(),
                "taskId": task_id,
                "customFieldGid": str(cf_gid),
                "customFieldName": cf.get("name"),
                "type": cf.get("type") or "unknown",
                "displayValue": cf.get("display_value"),
                "precision": cf.get("precision"),
                "numberValue": cf.get("number_value"),
                "enumOptionGid": enum_gid,
                "enumOptionName": enum_value.get("name") if enum_value else None,
                "enumOptionColor": enum_value.get("color") if enum_value else None,
                "customFieldId": cf_id,
                "enumOptionId": enum_id,
            })


def load_comment_json_records(json_dir: Path) -> list[dict[str, Any]]:
    """Carrega comentarios / stories do dump (nomes: comments_*.json, stories_*.json)."""
    by_gid: dict[str, dict[str, Any]] = {}
    for pattern in (r"^comments_.*\.json$", r"^stories_.*\.json$"):
        for row in load_list(json_dir, pattern):
            gid = row.get("gid")
            if gid:
                by_gid[str(gid)] = row
    return list(by_gid.values())


def _comment_task_gid(record: dict[str, Any]) -> str | None:
    if record.get("task_gid"):
        return str(record["task_gid"])
    target = record.get("target")
    if isinstance(target, dict) and target.get("resource_type") == "task" and target.get("gid"):
        return str(target["gid"])
    parent = record.get("parent")
    if isinstance(parent, dict) and parent.get("resource_type") == "task" and parent.get("gid"):
        return str(parent["gid"])
    return None


def import_comments(conn: sqlite3.Connection, records: list[dict[str, Any]], _password_hash: str) -> None:
    for row in records:
        st = row.get("resource_subtype")
        if st is not None and st != "comment_added":
            continue
        task_gid = _comment_task_gid(row)
        if not task_gid:
            continue
        story_gid = row.get("gid")
        if not story_gid:
            continue
        task_id = get_id_by(conn, "Task", "asanaGid", task_gid)
        if not task_id:
            continue
        created_by = row.get("created_by") if isinstance(row.get("created_by"), dict) else {}
        author_gid = created_by.get("gid")
        author_id = get_id_by(conn, "User", "asanaGid", str(author_gid)) if author_gid else None
        text = (row.get("text") or "").strip()
        if not text:
            continue
        created_at = row.get("created_at")
        asana_created = created_at if isinstance(created_at, str) else None
        insert_or_update(
            conn,
            "Comment",
            ["asanaGid"],
            {
                "id": new_id(),
                "asanaGid": str(story_gid),
                "taskId": task_id,
                "authorId": author_id,
                "authorAsanaGid": str(author_gid) if author_gid else None,
                "content": text,
                "asanaCreatedAt": asana_created,
                "createdAt": now_iso(),
                "updatedAt": now_iso(),
            },
        )


def count_table(conn: sqlite3.Connection, table: str) -> int:
    try:
        return int(conn.execute(f"SELECT COUNT(*) FROM {q(table)}").fetchone()[0])
    except sqlite3.OperationalError:
        return -1


def main() -> int:
    parser = argparse.ArgumentParser(description="Importa JSONs do Asana para SQLite/Prisma.")
    parser.add_argument("--json-dir", required=True, help="Pasta contendo os JSONs exportados do Asana")
    parser.add_argument("--server-dir", default=".", help="Pasta apps/server. Padrão: diretório atual")
    parser.add_argument("--db", default=None, help="Caminho explícito do SQLite. Se omitido, lê DATABASE_URL do .env")
    parser.add_argument("--clear", action="store_true", help="Apaga os dados das tabelas importadas antes de popular")
    parser.add_argument("--import-users", action="store_true", help="Tambem cria/atualiza usuarios do dump. Por padrao, usuarios sao preservados.")
    parser.add_argument("--clear-comments", action="store_true", help="Remove comentarios importados (asanaGid NOT NULL) antes de importar stories")
    global IMPORT_USERS
    IMPORT_USERS = args.import_users

    server_dir = Path(args.server_dir).resolve()
    json_dir = Path(args.json_dir).resolve()
    if not json_dir.exists():
        raise SystemExit(f"Pasta de JSONs não encontrada: {json_dir}")

    db_path = resolve_db_path(server_dir, args.db)
    if not db_path.exists():
        raise SystemExit(f"Banco SQLite não encontrado: {db_path}\nRode antes: pnpx prisma migrate dev")

    print(f"[info] JSON dir: {json_dir}")
    print(f"[info] SQLite:   {db_path}")

    workspaces = load_list(json_dir, r"^workspaces.*\.json$")
    teams = load_list(json_dir, r"^teams.*\.json$")
    users = load_list(json_dir, r"^users.*\.json$")
    projects = load_list(json_dir, r"^projects.*\.json$")
    sections = load_list(json_dir, r"^sections.*\.json$")
    tags = load_list(json_dir, r"^tags.*\.json$")
    custom_fields = load_list(json_dir, r"^custom_fields.*\.json$")
    tasks = load_list(json_dir, r"^tasks.*\.json$")
    subtasks = load_list(json_dir, r"^subtasks.*\.json$")

    default_workspace_gid = workspaces[0].get("gid") if workspaces else None
    task_records = all_task_records(tasks, subtasks)

    with sqlite3.connect(db_path) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        if args.clear:
            print("[info] Limpando tabelas importadas...")
            clear_asana_tables(conn)

        print("[info] Importando...")
        import_workspaces(conn, workspaces)
        import_users(conn, users, args.password_hash)
        import_teams(conn, teams, default_workspace_gid)
        import_projects(conn, projects, args.password_hash)
        import_sections(conn, sections)
        import_tags(conn, tags)
        import_custom_fields(conn, custom_fields, args.password_hash)
        import_tasks_base(conn, task_records, args.password_hash)
        resolve_task_parents(conn)
        import_task_relations(conn, task_records)
        comment_rows = load_comment_json_records(json_dir)
        if args.clear_comments:
            print("[info] Limpando comentarios importados do Asana...")
            conn.execute('DELETE FROM "Comment" WHERE "asanaGid" IS NOT NULL')
        if comment_rows:
            print(f"[info] Importando comentarios ({len(comment_rows)} stories unicos)...")
            import_comments(conn, comment_rows, args.password_hash)
        conn.commit()

        print("\nResumo:")
        for table in [
            "AsanaWorkspace", "Team", "User", "Project", "Section", "Tag", "Task",
            "TaskMembership", "TaskFollower", "TaskLike", "TaskTag",
            "AsanaCustomField", "AsanaCustomFieldEnumOption", "ProjectCustomFieldSetting", "TaskCustomFieldValue",
            "Comment",
        ]:
            print(f"  {table}: {count_table(conn, table)}")

    print("\n[ok] Importação finalizada.")
    if IMPORT_USERS and args.password_hash == DEFAULT_PASSWORD_HASH:
        print("[aviso] User.passwordHash foi preenchido com o texto 'mk123'. Se seu login espera bcrypt/argon, rode novamente passando --password-hash com o hash correto.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
