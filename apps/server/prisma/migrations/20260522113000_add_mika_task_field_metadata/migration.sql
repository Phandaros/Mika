-- AlterTable
ALTER TABLE "AsanaCustomField" ADD COLUMN "mikaKey" TEXT;
ALTER TABLE "AsanaCustomField" ADD COLUMN "mikaLabel" TEXT;
ALTER TABLE "AsanaCustomField" ADD COLUMN "mikaTaskField" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AsanaCustomField" ADD COLUMN "mikaSortOrder" INTEGER;
ALTER TABLE "AsanaCustomField" ADD COLUMN "mikaListVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AsanaCustomField" ADD COLUMN "mikaDetailVisible" BOOLEAN NOT NULL DEFAULT true;

-- Backfill Mika global task field metadata from imported Asana fields.
UPDATE "AsanaCustomField"
SET "mikaKey" = 'status',
    "mikaLabel" = 'Status',
    "mikaTaskField" = true,
    "mikaSortOrder" = 10,
    "mikaListVisible" = true,
    "mikaDetailVisible" = true
WHERE lower("name") = 'status';

UPDATE "AsanaCustomField"
SET "mikaKey" = 'plataforma',
    "mikaLabel" = 'Plataforma',
    "mikaTaskField" = true,
    "mikaSortOrder" = 20,
    "mikaListVisible" = true,
    "mikaDetailVisible" = true
WHERE lower("name") = 'plataforma';

UPDATE "AsanaCustomField"
SET "mikaKey" = 'disciplina',
    "mikaLabel" = 'Disciplina',
    "mikaTaskField" = true,
    "mikaSortOrder" = 30,
    "mikaListVisible" = true,
    "mikaDetailVisible" = true
WHERE lower("name") = 'disciplina';

UPDATE "AsanaCustomField"
SET "mikaKey" = 'status-de-conclusao',
    "mikaLabel" = 'Status de Conclusao',
    "mikaTaskField" = true,
    "mikaSortOrder" = 40,
    "mikaListVisible" = true,
    "mikaDetailVisible" = true
WHERE lower("name") = 'status de conclusão' OR lower("name") = 'status de conclusao';

UPDATE "AsanaCustomField"
SET "mikaKey" = 'prazo-maximo',
    "mikaLabel" = 'Prazo Maximo',
    "mikaTaskField" = true,
    "mikaSortOrder" = 50,
    "mikaListVisible" = true,
    "mikaDetailVisible" = true
WHERE lower("name") = 'prazo máximo' OR lower("name") = 'prazo maximo';

UPDATE "AsanaCustomField"
SET "mikaKey" = 'dias-estimados',
    "mikaLabel" = 'Dias Estimados',
    "mikaTaskField" = true,
    "mikaSortOrder" = 60,
    "mikaListVisible" = true,
    "mikaDetailVisible" = true
WHERE lower("name") = 'dias estimados';

UPDATE "AsanaCustomField"
SET "mikaKey" = 'dias-conclusao',
    "mikaLabel" = 'Dias Conclusao',
    "mikaTaskField" = true,
    "mikaSortOrder" = 70,
    "mikaListVisible" = true,
    "mikaDetailVisible" = true
WHERE lower("name") = 'dias conclusão' OR lower("name") = 'dias conclusao';

UPDATE "AsanaCustomField"
SET "mikaKey" = 'etapa',
    "mikaLabel" = 'Etapa',
    "mikaTaskField" = true,
    "mikaSortOrder" = 80,
    "mikaListVisible" = true,
    "mikaDetailVisible" = true
WHERE lower("name") = 'etapa';

UPDATE "AsanaCustomField"
SET "mikaKey" = 'estimated-time',
    "mikaLabel" = 'Estimated time',
    "mikaTaskField" = true,
    "mikaSortOrder" = 90,
    "mikaListVisible" = false,
    "mikaDetailVisible" = false
WHERE lower("name") = 'estimated time';

-- CreateIndex
CREATE INDEX "AsanaCustomField_mikaKey_idx" ON "AsanaCustomField"("mikaKey");
CREATE INDEX "AsanaCustomField_mikaTaskField_idx" ON "AsanaCustomField"("mikaTaskField");
