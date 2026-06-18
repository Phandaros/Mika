-- CreateTable
CREATE TABLE "ProjectNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeetingMinute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingDate" TEXT NOT NULL,
    "meetingTime" TEXT,
    "content" TEXT,
    "externalParticipants" JSONB,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MeetingMinute_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeetingMinute_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeetingMinuteParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetingMinuteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "MeetingMinuteParticipant_meetingMinuteId_fkey" FOREIGN KEY ("meetingMinuteId") REFERENCES "MeetingMinute" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeetingMinuteParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN "projectNoteId" TEXT REFERENCES "ProjectNote" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD COLUMN "meetingMinuteId" TEXT REFERENCES "MeetingMinute" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ProjectNote_projectId_updatedAt_idx" ON "ProjectNote"("projectId", "updatedAt");
CREATE INDEX "ProjectNote_authorId_idx" ON "ProjectNote"("authorId");
CREATE INDEX "MeetingMinute_projectId_meetingDate_meetingTime_idx" ON "MeetingMinute"("projectId", "meetingDate", "meetingTime");
CREATE INDEX "MeetingMinute_authorId_idx" ON "MeetingMinute"("authorId");
CREATE UNIQUE INDEX "MeetingMinuteParticipant_meetingMinuteId_userId_key" ON "MeetingMinuteParticipant"("meetingMinuteId", "userId");
CREATE INDEX "MeetingMinuteParticipant_userId_idx" ON "MeetingMinuteParticipant"("userId");
CREATE INDEX "Attachment_projectNoteId_idx" ON "Attachment"("projectNoteId");
CREATE INDEX "Attachment_meetingMinuteId_idx" ON "Attachment"("meetingMinuteId");
