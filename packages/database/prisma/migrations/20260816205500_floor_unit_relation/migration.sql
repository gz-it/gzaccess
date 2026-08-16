-- Add Floor -> Unit relation for building administration.
CREATE INDEX "Unit_floorId_idx" ON "Unit"("floorId");

ALTER TABLE "Unit"
ADD CONSTRAINT "Unit_floorId_fkey"
FOREIGN KEY ("floorId") REFERENCES "Floor"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
