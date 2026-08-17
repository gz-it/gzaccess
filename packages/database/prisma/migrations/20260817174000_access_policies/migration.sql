CREATE TABLE "AccessPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "accessPointId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccessPolicy_personId_accessPointId_key" ON "AccessPolicy"("personId", "accessPointId");
CREATE INDEX "AccessPolicy_organizationId_idx" ON "AccessPolicy"("organizationId");
CREATE INDEX "AccessPolicy_buildingId_idx" ON "AccessPolicy"("buildingId");
CREATE INDEX "AccessPolicy_personId_idx" ON "AccessPolicy"("personId");
CREATE INDEX "AccessPolicy_accessPointId_idx" ON "AccessPolicy"("accessPointId");

ALTER TABLE "AccessPolicy" ADD CONSTRAINT "AccessPolicy_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccessPolicy" ADD CONSTRAINT "AccessPolicy_accessPointId_fkey" FOREIGN KEY ("accessPointId") REFERENCES "AccessPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
