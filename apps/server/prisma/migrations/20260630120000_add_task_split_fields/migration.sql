-- Add nullable fields used to track task split groups without touching existing rows.
ALTER TABLE "Task" ADD COLUMN "splitRootTaskId" TEXT;
ALTER TABLE "Task" ADD COLUMN "splitPartNumber" INTEGER;
ALTER TABLE "Task" ADD COLUMN "splitPartTotal" INTEGER;

CREATE INDEX "Task_splitRootTaskId_idx" ON "Task"("splitRootTaskId");
