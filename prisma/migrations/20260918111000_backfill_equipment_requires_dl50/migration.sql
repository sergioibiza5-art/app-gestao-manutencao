UPDATE "Equipment" AS equipment
SET "requiresDl50" = true
WHERE EXISTS (
  SELECT 1
  FROM "EquipmentDl50Assessment" AS assessment
  WHERE assessment."equipmentId" = equipment."id"
)
OR EXISTS (
  SELECT 1
  FROM "Document" AS document
  WHERE document."equipmentId" = equipment."id"
    AND document."type" = 'DL50_ASSESSMENT'
);
