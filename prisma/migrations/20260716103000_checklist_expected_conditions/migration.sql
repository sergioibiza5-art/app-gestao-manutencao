CREATE TABLE IF NOT EXISTS "ChecklistExpectedCondition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistExpectedCondition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChecklistExpectedCondition_name_key" ON "ChecklistExpectedCondition"("name");
CREATE INDEX IF NOT EXISTS "ChecklistExpectedCondition_active_sortOrder_idx" ON "ChecklistExpectedCondition"("active", "sortOrder");

INSERT INTO "ChecklistExpectedCondition" ("id", "name", "sortOrder")
SELECT
  concat('cec_', md5(value)),
  value,
  row_number() OVER (ORDER BY value)
FROM (
  SELECT DISTINCT trim("expectedCondition") AS value
  FROM "ChecklistItem"
  WHERE trim("expectedCondition") <> ''
  UNION
  SELECT 'Dentro dos parametros corretos'
  UNION
  SELECT 'Sem fugas'
  UNION
  SELECT 'Funcionamento correto'
  UNION
  SELECT 'Sem desgaste irregular'
  UNION
  SELECT 'Limpo e em bom estado'
  UNION
  SELECT 'Sem folgas ou ruidos anormais'
  UNION
  SELECT 'Condicao conforme criterio definido'
) AS source
WHERE NOT EXISTS (
  SELECT 1 FROM "ChecklistExpectedCondition" existing WHERE existing."name" = source.value
);
