DROP INDEX IF EXISTS "TaskReview_sourceTaskId_status_key";
CREATE UNIQUE INDEX IF NOT EXISTS "TaskReview_sourceTaskId_pending_key" ON "TaskReview"("sourceTaskId") WHERE "status" = 'PENDING';
