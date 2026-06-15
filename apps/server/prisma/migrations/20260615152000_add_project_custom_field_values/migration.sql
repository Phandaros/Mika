CREATE TABLE "ProjectCustomFieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "customFieldGid" TEXT NOT NULL,
    "customFieldName" TEXT,
    "type" TEXT NOT NULL,
    "displayValue" TEXT,
    "precision" INTEGER,
    "textValue" TEXT,
    "numberValue" REAL,
    "enumOptionGid" TEXT,
    "enumOptionName" TEXT,
    "enumOptionColor" TEXT,
    "multiEnumValues" JSONB,
    "customFieldId" TEXT,
    "enumOptionId" TEXT,
    CONSTRAINT "ProjectCustomFieldValue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectCustomFieldValue_customFieldId_fkey" FOREIGN KEY ("customFieldId") REFERENCES "AsanaCustomField" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProjectCustomFieldValue_enumOptionId_fkey" FOREIGN KEY ("enumOptionId") REFERENCES "AsanaCustomFieldEnumOption" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProjectCustomFieldValue_projectId_customFieldGid_key" ON "ProjectCustomFieldValue"("projectId", "customFieldGid");
CREATE INDEX "ProjectCustomFieldValue_customFieldGid_idx" ON "ProjectCustomFieldValue"("customFieldGid");
CREATE INDEX "ProjectCustomFieldValue_customFieldId_idx" ON "ProjectCustomFieldValue"("customFieldId");
