-- Add operational soft delete fields for tasks preserved by submitted weekly reports.
ALTER TABLE "Task" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Task" ADD COLUMN "deletedByUserId" TEXT;

CREATE INDEX "Task_deletedAt_idx" ON "Task"("deletedAt");
CREATE INDEX "Task_deletedByUserId_idx" ON "Task"("deletedByUserId");
