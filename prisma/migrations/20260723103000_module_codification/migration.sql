CREATE TABLE "ModuleCodification" (
    "id" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleCodification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModuleCodification_moduleKey_key" ON "ModuleCodification"("moduleKey");
