-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asanaGid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "htmlNotes" TEXT,
    "resourceType" TEXT,
    "assigneeStatus" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "liked" BOOLEAN NOT NULL DEFAULT false,
    "numLikes" INTEGER NOT NULL DEFAULT 0,
    "numSubtasks" INTEGER NOT NULL DEFAULT 0,
    "localStatus" TEXT,
    "priority" TEXT,
    "dueAt" DATETIME,
    "completedAtAsana" DATETIME,
    "asanaCreatedAt" DATETIME,
    "asanaModifiedAt" DATETIME,
    "dueOn" TEXT,
    "startOn" TEXT,
    "estimatedDays" REAL,
    "platform" TEXT,
    "discipline" TEXT,
    "estimatedTime" REAL,
    "maxDeadline" DATETIME,
    "conclusionDays" REAL,
    "stage" TEXT,
    "assigneeGid" TEXT,
    "createdByUserId" TEXT,
    "workflowRootTaskId" TEXT,
    "adjustmentNumber" INTEGER NOT NULL DEFAULT 0,
    "parentAsanaGid" TEXT,
    "parentName" TEXT,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_assigneeGid_fkey" FOREIGN KEY ("assigneeGid") REFERENCES "User" ("asanaGid") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_workflowRootTaskId_fkey" FOREIGN KEY ("workflowRootTaskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("asanaCreatedAt", "asanaGid", "asanaModifiedAt", "assigneeGid", "assigneeStatus", "completed", "completedAtAsana", "conclusionDays", "createdAt", "discipline", "dueAt", "dueOn", "estimatedDays", "estimatedTime", "htmlNotes", "id", "liked", "localStatus", "maxDeadline", "name", "notes", "numLikes", "numSubtasks", "parentAsanaGid", "parentId", "parentName", "platform", "priority", "resourceType", "stage", "startOn", "updatedAt")
SELECT "asanaCreatedAt", "asanaGid", "asanaModifiedAt", "assigneeGid", "assigneeStatus", "completed", "completedAtAsana", "conclusionDays", "createdAt", "discipline", "dueAt", "dueOn", "estimatedDays", "estimatedTime", "htmlNotes", "id", "liked", "localStatus", "maxDeadline", "name", "notes", "numLikes", "numSubtasks", "parentAsanaGid", "parentId", "parentName", "platform", "priority", "resourceType", "stage", "startOn", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE UNIQUE INDEX "Task_asanaGid_key" ON "Task"("asanaGid");
CREATE INDEX "Task_name_idx" ON "Task"("name");
CREATE INDEX "Task_assigneeGid_idx" ON "Task"("assigneeGid");
CREATE INDEX "Task_createdByUserId_idx" ON "Task"("createdByUserId");
CREATE INDEX "Task_workflowRootTaskId_idx" ON "Task"("workflowRootTaskId");
CREATE INDEX "Task_parentAsanaGid_idx" ON "Task"("parentAsanaGid");
CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");
CREATE INDEX "Task_completed_idx" ON "Task"("completed");
CREATE INDEX "Task_dueOn_idx" ON "Task"("dueOn");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE TABLE "TaskReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceTaskId" TEXT NOT NULL,
    "rootTaskId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "requestedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "startOn" TEXT,
    "dueOn" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaskReview_sourceTaskId_fkey" FOREIGN KEY ("sourceTaskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskReview_rootTaskId_fkey" FOREIGN KEY ("rootTaskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaskReview_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TaskReview_sourceTaskId_pending_key" ON "TaskReview"("sourceTaskId") WHERE "status" = 'PENDING';
CREATE INDEX "TaskReview_rootTaskId_idx" ON "TaskReview"("rootTaskId");
CREATE INDEX "TaskReview_reviewerId_idx" ON "TaskReview"("reviewerId");
CREATE INDEX "TaskReview_requestedById_idx" ON "TaskReview"("requestedById");
CREATE INDEX "TaskReview_status_idx" ON "TaskReview"("status");
CREATE INDEX "TaskReview_createdAt_idx" ON "TaskReview"("createdAt");
