CREATE TABLE "StoragePosition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "room" TEXT,
    "shelf" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "title" TEXT,
    "contents" TEXT NOT NULL,
    "notes" TEXT,
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ORGANIZED',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoragePosition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoragePosition_code_key" ON "StoragePosition"("code");
CREATE INDEX "StoragePosition_shelf_level_idx" ON "StoragePosition"("shelf", "level");
CREATE INDEX "StoragePosition_room_idx" ON "StoragePosition"("room");
CREATE INDEX "StoragePosition_status_idx" ON "StoragePosition"("status");
