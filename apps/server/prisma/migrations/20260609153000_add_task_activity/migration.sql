-- CreateTable
CREATE TABLE "TaskActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "field" TEXT,
    "fromValue" TEXT,
    "toValue" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TaskActivity_taskId_idx" ON "TaskActivity"("taskId");

-- CreateIndex
CREATE INDEX "TaskActivity_actorId_idx" ON "TaskActivity"("actorId");

-- CreateIndex
CREATE INDEX "TaskActivity_createdAt_idx" ON "TaskActivity"("createdAt");
