-- AlterTable
ALTER TABLE "Task" ADD COLUMN "conclusionDays" REAL;
ALTER TABLE "Task" ADD COLUMN "discipline" TEXT;
ALTER TABLE "Task" ADD COLUMN "estimatedTime" REAL;
ALTER TABLE "Task" ADD COLUMN "maxDeadline" DATETIME;
ALTER TABLE "Task" ADD COLUMN "platform" TEXT;
ALTER TABLE "Task" ADD COLUMN "stage" TEXT;
