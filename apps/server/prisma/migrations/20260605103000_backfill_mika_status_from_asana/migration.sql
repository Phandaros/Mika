-- Backfill Mika task status from Asana legacy data without renaming the legacy DB column.
UPDATE "Task"
SET "localStatus" = 'FINISHED',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "completed" = true;

UPDATE "Task"
SET "localStatus" = (
  SELECT CASE lower(coalesce("TaskCustomFieldValue"."enumOptionName", "TaskCustomFieldValue"."displayValue"))
    WHEN 'a fazer' THEN 'TODO'
    WHEN 'no cronograma' THEN 'ON_SCHEDULE'
    WHEN 'em andamento' THEN 'IN_PROGRESS'
    WHEN 'aguardando revisão' THEN 'AWAITING_REVIEW'
    WHEN 'aguardando revisao' THEN 'AWAITING_REVIEW'
    WHEN 'em análise' THEN 'IN_ANALYSIS'
    WHEN 'em analise' THEN 'IN_ANALYSIS'
    WHEN 'aguardando definição' THEN 'AWAITING_DEFINITION'
    WHEN 'aguardando definicao' THEN 'AWAITING_DEFINITION'
    WHEN 'aguardando aprovação' THEN 'AWAITING_DEFINITION'
    WHEN 'aguardando aprovacao' THEN 'AWAITING_DEFINITION'
    WHEN 'finalizado' THEN 'FINISHED'
    WHEN 'finalizada' THEN 'FINISHED'
    ELSE NULL
  END
  FROM "TaskCustomFieldValue"
  INNER JOIN "AsanaCustomField" ON "AsanaCustomField"."id" = "TaskCustomFieldValue"."customFieldId"
  WHERE "TaskCustomFieldValue"."taskId" = "Task"."id"
    AND "AsanaCustomField"."mikaKey" = 'status'
    AND lower(coalesce("TaskCustomFieldValue"."enumOptionName", "TaskCustomFieldValue"."displayValue")) IN (
      'a fazer',
      'no cronograma',
      'em andamento',
      'aguardando revisão',
      'aguardando revisao',
      'em análise',
      'em analise',
      'aguardando definição',
      'aguardando definicao',
      'aguardando aprovação',
      'aguardando aprovacao',
      'finalizado',
      'finalizada'
    )
  LIMIT 1
),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "completed" = false
  AND EXISTS (
    SELECT 1
    FROM "TaskCustomFieldValue"
    INNER JOIN "AsanaCustomField" ON "AsanaCustomField"."id" = "TaskCustomFieldValue"."customFieldId"
    WHERE "TaskCustomFieldValue"."taskId" = "Task"."id"
      AND "AsanaCustomField"."mikaKey" = 'status'
      AND lower(coalesce("TaskCustomFieldValue"."enumOptionName", "TaskCustomFieldValue"."displayValue")) IN (
        'a fazer',
        'no cronograma',
        'em andamento',
        'aguardando revisão',
        'aguardando revisao',
        'em análise',
        'em analise',
        'aguardando definição',
        'aguardando definicao',
        'aguardando aprovação',
        'aguardando aprovacao',
        'finalizado',
        'finalizada'
      )
  );
