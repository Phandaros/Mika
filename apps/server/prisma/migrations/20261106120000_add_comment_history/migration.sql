-- CreateTable
CREATE TABLE "CommentRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT,
    "actorId" TEXT,
    "commentCreatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommentRevision_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommentRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CommentRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commentId" TEXT,
    "commentRevisionId" TEXT,
    "projectNoteId" TEXT,
    "meetingMinuteId" TEXT,
    "filename" TEXT NOT NULL,
    "storedAs" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_commentRevisionId_fkey" FOREIGN KEY ("commentRevisionId") REFERENCES "CommentRevision" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_projectNoteId_fkey" FOREIGN KEY ("projectNoteId") REFERENCES "ProjectNote" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_meetingMinuteId_fkey" FOREIGN KEY ("meetingMinuteId") REFERENCES "MeetingMinute" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Attachment" ("commentId", "createdAt", "filename", "id", "meetingMinuteId", "mimeType", "projectNoteId", "sizeBytes", "storedAs", "uploadedById") SELECT "commentId", "createdAt", "filename", "id", "meetingMinuteId", "mimeType", "projectNoteId", "sizeBytes", "storedAs", "uploadedById" FROM "Attachment";
DROP TABLE "Attachment";
ALTER TABLE "new_Attachment" RENAME TO "Attachment";
CREATE INDEX "Attachment_commentId_idx" ON "Attachment"("commentId");
CREATE INDEX "Attachment_commentRevisionId_idx" ON "Attachment"("commentRevisionId");
CREATE INDEX "Attachment_projectNoteId_idx" ON "Attachment"("projectNoteId");
CREATE INDEX "Attachment_meetingMinuteId_idx" ON "Attachment"("meetingMinuteId");
CREATE INDEX "Attachment_uploadedById_idx" ON "Attachment"("uploadedById");
CREATE TABLE "new_Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT,
    "content" TEXT NOT NULL,
    "asanaGid" TEXT,
    "authorAsanaGid" TEXT,
    "asanaCreatedAt" DATETIME,
    "editedAt" DATETIME,
    "editedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Comment_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Comment" ("asanaCreatedAt", "asanaGid", "authorAsanaGid", "authorId", "content", "createdAt", "id", "taskId", "updatedAt") SELECT "asanaCreatedAt", "asanaGid", "authorAsanaGid", "authorId", "content", "createdAt", "id", "taskId", "updatedAt" FROM "Comment";
DROP TABLE "Comment";
ALTER TABLE "new_Comment" RENAME TO "Comment";
CREATE UNIQUE INDEX "Comment_asanaGid_key" ON "Comment"("asanaGid");
CREATE INDEX "Comment_taskId_idx" ON "Comment"("taskId");
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");
CREATE INDEX "Comment_editedById_idx" ON "Comment"("editedById");
CREATE INDEX "Comment_asanaGid_idx" ON "Comment"("asanaGid");
CREATE INDEX "Comment_authorAsanaGid_idx" ON "Comment"("authorAsanaGid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CommentRevision_taskId_createdAt_idx" ON "CommentRevision"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "CommentRevision_commentId_idx" ON "CommentRevision"("commentId");

-- CreateIndex
CREATE INDEX "CommentRevision_authorId_idx" ON "CommentRevision"("authorId");

-- CreateIndex
CREATE INDEX "CommentRevision_actorId_idx" ON "CommentRevision"("actorId");

