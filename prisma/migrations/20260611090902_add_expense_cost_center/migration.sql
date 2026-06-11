-- DropIndex
DROP INDEX "Consumable_equipmentId_idx";

-- DropIndex
DROP INDEX "Document_vehicleId_idx";

-- DropIndex
DROP INDEX "Expense_equipmentId_idx";

-- DropIndex
DROP INDEX "Expense_vehicleId_idx";

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "costCenter" TEXT;
