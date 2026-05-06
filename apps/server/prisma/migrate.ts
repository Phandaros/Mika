import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl?.startsWith("file:")) {
  throw new Error("DATABASE_URL must be a SQLite file URL");
}

function databasePathFromUrl(url: string): string {
  const sqlitePath = url.replace("file:", "");
  return path.resolve("prisma", sqlitePath);
}

const dbPath = databasePathFromUrl(databaseUrl);
const migrationsDir = path.resolve("prisma", "migrations");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checksum" TEXT NOT NULL,
    "finished_at" DATETIME,
    "migration_name" TEXT NOT NULL,
    "logs" TEXT,
    "rolled_back_at" DATETIME,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
  );
`);

const migrationNames = fs
  .readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const migrationName of migrationNames) {
  const existing = db
    .prepare('SELECT COUNT(*) AS count FROM "_prisma_migrations" WHERE "migration_name" = ?')
    .get(migrationName) as { count: number };

  if (existing.count > 0) {
    continue;
  }

  const migrationPath = path.join(migrationsDir, migrationName, "migration.sql");
  const sql = fs.readFileSync(migrationPath, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");

  db.exec(sql);
  db.prepare(
    'INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") VALUES (?, ?, CURRENT_TIMESTAMP, ?, NULL, NULL, CURRENT_TIMESTAMP, 1)'
  ).run(randomUUID(), checksum, migrationName);
}

db.close();

console.log("Migrations aplicadas");
