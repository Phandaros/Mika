/*
  Warnings:

  - You are about to drop the `Attachment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Comment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Discipline` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `areaM2` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `builder` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `client` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `platform` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `assigneeId` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `completedAt` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `creatorId` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `disciplineId` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `dueDate` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `avatarUrl` on the `User` table. All the data in the column will be lost.
  - Added the required column `asanaGid` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceGid` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `asanaGid` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Attachment";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Comment";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Discipline";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Notification";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "AsanaWorkspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asanaGid" TEXT NOT NULL,
    "resourceType" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asanaGid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workspaceGid" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Team_workspaceGid_fkey" FOREIGN KEY ("workspaceGid") REFERENCES "AsanaWorkspace" ("asanaGid") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectFollower" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userGid" TEXT NOT NULL,
    CONSTRAINT "ProjectFollower_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectFollower_userGid_fkey" FOREIGN KEY ("userGid") REFERENCES "User" ("asanaGid") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userGid" TEXT NOT NULL,
    CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectMember_userGid_fkey" FOREIGN KEY ("userGid") REFERENCES "User" ("asanaGid") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asanaGid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectGid" TEXT NOT NULL,
    "asanaCreatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Section_projectGid_fkey" FOREIGN KEY ("projectGid") REFERENCES "Project" ("asanaGid") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "projectGid" TEXT,
    "projectName" TEXT,
    "sectionGid" TEXT,
    "sectionName" TEXT,
    CONSTRAINT "TaskMembership_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskMembership_projectGid_fkey" FOREIGN KEY ("projectGid") REFERENCES "Project" ("asanaGid") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskMembership_sectionGid_fkey" FOREIGN KEY ("sectionGid") REFERENCES "Section" ("asanaGid") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskFollower" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "userGid" TEXT NOT NULL,
    CONSTRAINT "TaskFollower_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskFollower_userGid_fkey" FOREIGN KEY ("userGid") REFERENCES "User" ("asanaGid") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "userGid" TEXT NOT NULL,
    CONSTRAINT "TaskLike_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskLike_userGid_fkey" FOREIGN KEY ("userGid") REFERENCES "User" ("asanaGid") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asanaGid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "asanaCreatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TaskTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "tagGid" TEXT NOT NULL,
    CONSTRAINT "TaskTag_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskTag_tagGid_fkey" FOREIGN KEY ("tagGid") REFERENCES "Tag" ("asanaGid") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AsanaCustomField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asanaGid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "precision" INTEGER,
    "format" TEXT,
    "currencyCode" TEXT,
    "isGlobalToWorkspace" BOOLEAN NOT NULL DEFAULT false,
    "createdByGid" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsanaCustomField_createdByGid_fkey" FOREIGN KEY ("createdByGid") REFERENCES "User" ("asanaGid") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AsanaCustomFieldEnumOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asanaGid" TEXT NOT NULL,
    "customFieldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER,
    CONSTRAINT "AsanaCustomFieldEnumOption_customFieldId_fkey" FOREIGN KEY ("customFieldId") REFERENCES "AsanaCustomField" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectCustomFieldSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asanaGid" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "customFieldId" TEXT NOT NULL,
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ProjectCustomFieldSetting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectCustomFieldSetting_customFieldId_fkey" FOREIGN KEY ("customFieldId") REFERENCES "AsanaCustomField" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskCustomFieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "customFieldGid" TEXT NOT NULL,
    "customFieldName" TEXT,
    "type" TEXT NOT NULL,
    "displayValue" TEXT,
    "precision" INTEGER,
    "numberValue" REAL,
    "enumOptionGid" TEXT,
    "enumOptionName" TEXT,
    "enumOptionColor" TEXT,
    "customFieldId" TEXT,
    "enumOptionId" TEXT,
    CONSTRAINT "TaskCustomFieldValue_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskCustomFieldValue_customFieldId_fkey" FOREIGN KEY ("customFieldId") REFERENCES "AsanaCustomField" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskCustomFieldValue_enumOptionId_fkey" FOREIGN KEY ("enumOptionId") REFERENCES "AsanaCustomFieldEnumOption" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asanaGid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "htmlNotes" TEXT,
    "permalinkUrl" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "public" BOOLEAN NOT NULL DEFAULT false,
    "defaultView" TEXT,
    "currentStatusGid" TEXT,
    "currentStatusColor" TEXT,
    "currentStatusText" TEXT,
    "statusUpdateGid" TEXT,
    "startOn" TEXT,
    "dueOn" TEXT,
    "dueDate" TEXT,
    "asanaCreatedAt" DATETIME,
    "asanaModifiedAt" DATETIME,
    "ownerGid" TEXT,
    "teamGid" TEXT,
    "workspaceGid" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_ownerGid_fkey" FOREIGN KEY ("ownerGid") REFERENCES "User" ("asanaGid") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_teamGid_fkey" FOREIGN KEY ("teamGid") REFERENCES "Team" ("asanaGid") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_workspaceGid_fkey" FOREIGN KEY ("workspaceGid") REFERENCES "AsanaWorkspace" ("asanaGid") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("createdAt", "id", "name", "updatedAt") SELECT "createdAt", "id", "name", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_asanaGid_key" ON "Project"("asanaGid");
CREATE INDEX "Project_name_idx" ON "Project"("name");
CREATE INDEX "Project_ownerGid_idx" ON "Project"("ownerGid");
CREATE INDEX "Project_teamGid_idx" ON "Project"("teamGid");
CREATE INDEX "Project_workspaceGid_idx" ON "Project"("workspaceGid");
CREATE INDEX "Project_archived_idx" ON "Project"("archived");
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
    "assigneeGid" TEXT,
    "parentAsanaGid" TEXT,
    "parentName" TEXT,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_assigneeGid_fkey" FOREIGN KEY ("assigneeGid") REFERENCES "User" ("asanaGid") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("createdAt", "id", "priority", "updatedAt") SELECT "createdAt", "id", "priority", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE UNIQUE INDEX "Task_asanaGid_key" ON "Task"("asanaGid");
CREATE INDEX "Task_name_idx" ON "Task"("name");
CREATE INDEX "Task_assigneeGid_idx" ON "Task"("assigneeGid");
CREATE INDEX "Task_parentAsanaGid_idx" ON "Task"("parentAsanaGid");
CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");
CREATE INDEX "Task_completed_idx" ON "Task"("completed");
CREATE INDEX "Task_dueOn_idx" ON "Task"("dueOn");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asanaGid" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "photo21x21" TEXT,
    "photo27x27" TEXT,
    "photo36x36" TEXT,
    "photo60x60" TEXT,
    "photo128x128" TEXT,
    "photoOriginal" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "id", "isActive", "name", "passwordHash", "role", "updatedAt") SELECT "createdAt", "email", "id", "isActive", "name", "passwordHash", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_asanaGid_key" ON "User"("asanaGid");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_asanaGid_idx" ON "User"("asanaGid");
CREATE INDEX "User_email_idx" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AsanaWorkspace_asanaGid_key" ON "AsanaWorkspace"("asanaGid");

-- CreateIndex
CREATE UNIQUE INDEX "Team_asanaGid_key" ON "Team"("asanaGid");

-- CreateIndex
CREATE INDEX "Team_workspaceGid_idx" ON "Team"("workspaceGid");

-- CreateIndex
CREATE INDEX "ProjectFollower_userGid_idx" ON "ProjectFollower"("userGid");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectFollower_projectId_userGid_key" ON "ProjectFollower"("projectId", "userGid");

-- CreateIndex
CREATE INDEX "ProjectMember_userGid_idx" ON "ProjectMember"("userGid");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userGid_key" ON "ProjectMember"("projectId", "userGid");

-- CreateIndex
CREATE UNIQUE INDEX "Section_asanaGid_key" ON "Section"("asanaGid");

-- CreateIndex
CREATE INDEX "Section_projectGid_idx" ON "Section"("projectGid");

-- CreateIndex
CREATE INDEX "Section_name_idx" ON "Section"("name");

-- CreateIndex
CREATE INDEX "TaskMembership_projectGid_idx" ON "TaskMembership"("projectGid");

-- CreateIndex
CREATE INDEX "TaskMembership_sectionGid_idx" ON "TaskMembership"("sectionGid");

-- CreateIndex
CREATE UNIQUE INDEX "TaskMembership_taskId_projectGid_sectionGid_key" ON "TaskMembership"("taskId", "projectGid", "sectionGid");

-- CreateIndex
CREATE INDEX "TaskFollower_userGid_idx" ON "TaskFollower"("userGid");

-- CreateIndex
CREATE UNIQUE INDEX "TaskFollower_taskId_userGid_key" ON "TaskFollower"("taskId", "userGid");

-- CreateIndex
CREATE INDEX "TaskLike_userGid_idx" ON "TaskLike"("userGid");

-- CreateIndex
CREATE UNIQUE INDEX "TaskLike_taskId_userGid_key" ON "TaskLike"("taskId", "userGid");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_asanaGid_key" ON "Tag"("asanaGid");

-- CreateIndex
CREATE INDEX "Tag_name_idx" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "TaskTag_tagGid_idx" ON "TaskTag"("tagGid");

-- CreateIndex
CREATE UNIQUE INDEX "TaskTag_taskId_tagGid_key" ON "TaskTag"("taskId", "tagGid");

-- CreateIndex
CREATE UNIQUE INDEX "AsanaCustomField_asanaGid_key" ON "AsanaCustomField"("asanaGid");

-- CreateIndex
CREATE INDEX "AsanaCustomField_name_idx" ON "AsanaCustomField"("name");

-- CreateIndex
CREATE INDEX "AsanaCustomField_type_idx" ON "AsanaCustomField"("type");

-- CreateIndex
CREATE INDEX "AsanaCustomField_createdByGid_idx" ON "AsanaCustomField"("createdByGid");

-- CreateIndex
CREATE UNIQUE INDEX "AsanaCustomFieldEnumOption_asanaGid_key" ON "AsanaCustomFieldEnumOption"("asanaGid");

-- CreateIndex
CREATE INDEX "AsanaCustomFieldEnumOption_customFieldId_idx" ON "AsanaCustomFieldEnumOption"("customFieldId");

-- CreateIndex
CREATE INDEX "AsanaCustomFieldEnumOption_name_idx" ON "AsanaCustomFieldEnumOption"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCustomFieldSetting_asanaGid_key" ON "ProjectCustomFieldSetting"("asanaGid");

-- CreateIndex
CREATE INDEX "ProjectCustomFieldSetting_customFieldId_idx" ON "ProjectCustomFieldSetting"("customFieldId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCustomFieldSetting_projectId_customFieldId_key" ON "ProjectCustomFieldSetting"("projectId", "customFieldId");

-- CreateIndex
CREATE INDEX "TaskCustomFieldValue_customFieldGid_idx" ON "TaskCustomFieldValue"("customFieldGid");

-- CreateIndex
CREATE INDEX "TaskCustomFieldValue_customFieldId_idx" ON "TaskCustomFieldValue"("customFieldId");

-- CreateIndex
CREATE INDEX "TaskCustomFieldValue_enumOptionGid_idx" ON "TaskCustomFieldValue"("enumOptionGid");

-- CreateIndex
CREATE INDEX "TaskCustomFieldValue_enumOptionId_idx" ON "TaskCustomFieldValue"("enumOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCustomFieldValue_taskId_customFieldGid_key" ON "TaskCustomFieldValue"("taskId", "customFieldGid");
