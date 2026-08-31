PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

ALTER TABLE "ProjectNote" ADD COLUMN "noteDate" TEXT;

UPDATE "ProjectNote"
SET "noteDate" = COALESCE(
  strftime('%Y-%m-%d', "createdAt", '-3 hours'),
  strftime('%Y-%m-%d', 'now', '-3 hours')
);

CREATE TABLE "new_ProjectNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "noteDate" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_ProjectNote" ("authorId", "content", "createdAt", "id", "noteDate", "projectId", "title", "updatedAt")
SELECT "authorId", "content", "createdAt", "id", "noteDate", "projectId", "title", "updatedAt"
FROM "ProjectNote";

DROP TABLE "ProjectNote";
ALTER TABLE "new_ProjectNote" RENAME TO "ProjectNote";

CREATE INDEX "ProjectNote_projectId_noteDate_idx" ON "ProjectNote"("projectId", "noteDate");
CREATE INDEX "ProjectNote_projectId_updatedAt_idx" ON "ProjectNote"("projectId", "updatedAt");
CREATE INDEX "ProjectNote_authorId_idx" ON "ProjectNote"("authorId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
