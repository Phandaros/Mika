-- CreateTable
CREATE TABLE "CompanyHoliday" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompanyHoliday_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyHoliday_date_key" ON "CompanyHoliday"("date");

-- CreateIndex
CREATE INDEX "CompanyHoliday_date_idx" ON "CompanyHoliday"("date");

-- CreateIndex
CREATE INDEX "CompanyHoliday_createdBy_idx" ON "CompanyHoliday"("createdBy");
