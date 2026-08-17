-- Add parking spaces managed per building.
CREATE TABLE "ParkingSpace" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "floorId" TEXT,
    "unitId" TEXT,
    "label" TEXT NOT NULL,

    CONSTRAINT "ParkingSpace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParkingSpace_buildingId_label_key" ON "ParkingSpace"("buildingId", "label");
CREATE INDEX "ParkingSpace_organizationId_idx" ON "ParkingSpace"("organizationId");
CREATE INDEX "ParkingSpace_buildingId_idx" ON "ParkingSpace"("buildingId");
CREATE INDEX "ParkingSpace_floorId_idx" ON "ParkingSpace"("floorId");
CREATE INDEX "ParkingSpace_unitId_idx" ON "ParkingSpace"("unitId");

ALTER TABLE "ParkingSpace"
ADD CONSTRAINT "ParkingSpace_buildingId_fkey"
FOREIGN KEY ("buildingId") REFERENCES "Building"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ParkingSpace"
ADD CONSTRAINT "ParkingSpace_floorId_fkey"
FOREIGN KEY ("floorId") REFERENCES "Floor"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ParkingSpace"
ADD CONSTRAINT "ParkingSpace_unitId_fkey"
FOREIGN KEY ("unitId") REFERENCES "Unit"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
