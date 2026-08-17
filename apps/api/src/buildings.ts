import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createOpaqueToken,
  hashOpaqueToken,
  requireOrganizationAccess,
} from "@gzaccess/auth";
import type { AuthenticatedUser } from "@gzaccess/contracts";
import { prisma, type PrismaClient } from "@gzaccess/database";
import { AuthError, getAuthenticatedUser, type AuthStore } from "./auth.js";

export interface BuildingSummary {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  timezone: string;
}

export interface UnitSummary {
  id: string;
  organizationId: string;
  buildingId: string;
  label: string;
  floorId?: string | null;
  floorName?: string | null;
}

export interface FloorSummary {
  id: string;
  organizationId: string;
  buildingId: string;
  name: string;
  sortOrder: number;
}

export interface ParkingSpaceSummary {
  id: string;
  organizationId: string;
  buildingId: string;
  floorId?: string | null;
  floorName?: string | null;
  unitId?: string | null;
  unitLabel?: string | null;
  label: string;
}

export interface ResidentInvite {
  personId: string;
  userId?: string;
  activationToken?: string;
}

export interface ResidentSummary {
  personId: string;
  buildingId: string;
  unitId?: string | null;
  unitLabel?: string | null;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  documentNumber?: string | null;
}

export interface BuildingStore {
  createBuilding(
    user: AuthenticatedUser,
    input: CreateBuildingInput,
  ): Promise<{
    building: BuildingSummary;
  }>;
  listBuildings(
    user: AuthenticatedUser,
    organizationId: string,
  ): Promise<{ buildings: BuildingSummary[] }>;
  listUnits(
    user: AuthenticatedUser,
    buildingId: string,
  ): Promise<{ units: UnitSummary[] }>;
  createFloor(
    user: AuthenticatedUser,
    input: CreateFloorInput,
  ): Promise<{ floor: FloorSummary }>;
  listFloors(
    user: AuthenticatedUser,
    buildingId: string,
  ): Promise<{ floors: FloorSummary[] }>;
  createParkingSpace(
    user: AuthenticatedUser,
    input: CreateParkingSpaceInput,
  ): Promise<{ parkingSpace: ParkingSpaceSummary }>;
  listParkingSpaces(
    user: AuthenticatedUser,
    buildingId: string,
  ): Promise<{ parkingSpaces: ParkingSpaceSummary[] }>;
  createUnit(
    user: AuthenticatedUser,
    input: CreateUnitInput,
  ): Promise<{ unit: UnitSummary }>;
  registerResident(
    user: AuthenticatedUser,
    input: RegisterResidentInput,
  ): Promise<ResidentInvite>;
  listResidents(
    user: AuthenticatedUser,
    buildingId: string,
  ): Promise<{ residents: ResidentSummary[] }>;
}

type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
type CreateFloorInput = z.infer<typeof createFloorSchema>;
type CreateParkingSpaceInput = z.infer<typeof createParkingSpaceSchema>;
type CreateUnitInput = z.infer<typeof createUnitSchema>;
type RegisterResidentInput = z.infer<typeof registerResidentSchema>;

interface StoredPerson {
  id: string;
  organizationId: string;
  buildingId: string;
  unitId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  documentNumber?: string;
}

interface StoredUser {
  id: string;
  email: string;
  displayName: string;
}

export class InMemoryBuildingStore implements BuildingStore {
  private readonly buildings = new Map<string, BuildingSummary>();
  private readonly floors = new Map<string, FloorSummary>();
  private readonly parkingSpaces = new Map<string, ParkingSpaceSummary>();
  private readonly units = new Map<string, UnitSummary>();
  private readonly persons = new Map<string, StoredPerson>();
  private readonly users = new Map<string, StoredUser>();

  async createBuilding(user: AuthenticatedUser, input: CreateBuildingInput) {
    requireOrganizationAccess(user, input.organizationId);
    const building: BuildingSummary = {
      id: createId("bld"),
      organizationId: input.organizationId,
      name: input.name,
      address: input.address,
      timezone: input.timezone,
    };
    this.buildings.set(building.id, building);

    return { building };
  }

  async listBuildings(user: AuthenticatedUser, organizationId: string) {
    requireOrganizationAccess(user, organizationId);

    return {
      buildings: [...this.buildings.values()].filter(
        (building) => building.organizationId === organizationId,
      ),
    };
  }

  async createUnit(user: AuthenticatedUser, input: CreateUnitInput) {
    const building = this.getBuilding(input.buildingId);
    requireOrganizationAccess(user, building.organizationId);
    const floor = input.floorId
      ? this.getFloor(input.floorId, building.id)
      : undefined;
    const unit: UnitSummary = {
      id: createId("unt"),
      organizationId: building.organizationId,
      buildingId: building.id,
      label: input.label,
      floorId: floor?.id,
      floorName: floor?.name,
    };
    this.units.set(unit.id, unit);

    return { unit };
  }

  async createFloor(user: AuthenticatedUser, input: CreateFloorInput) {
    const building = this.getBuilding(input.buildingId);
    requireOrganizationAccess(user, building.organizationId);
    const floor: FloorSummary = {
      id: createId("flr"),
      organizationId: building.organizationId,
      buildingId: building.id,
      name: input.name,
      sortOrder: input.sortOrder,
    };
    this.floors.set(floor.id, floor);

    return { floor };
  }

  async listFloors(user: AuthenticatedUser, buildingId: string) {
    const building = this.getBuilding(buildingId);
    requireOrganizationAccess(user, building.organizationId);

    return {
      floors: [...this.floors.values()]
        .filter((floor) => floor.buildingId === buildingId)
        .sort(compareFloors),
    };
  }

  async listUnits(user: AuthenticatedUser, buildingId: string) {
    const building = this.getBuilding(buildingId);
    requireOrganizationAccess(user, building.organizationId);

    return {
      units: [...this.units.values()].filter(
        (unit) => unit.buildingId === buildingId,
      ),
    };
  }

  async createParkingSpace(
    user: AuthenticatedUser,
    input: CreateParkingSpaceInput,
  ) {
    const building = this.getBuilding(input.buildingId);
    requireOrganizationAccess(user, building.organizationId);
    const floor = input.floorId
      ? this.getFloor(input.floorId, building.id)
      : undefined;
    const unit = input.unitId
      ? this.getUnit(input.unitId, building.id)
      : undefined;
    const parkingSpace: ParkingSpaceSummary = {
      id: createId("prk"),
      organizationId: building.organizationId,
      buildingId: building.id,
      floorId: floor?.id,
      floorName: floor?.name,
      unitId: unit?.id,
      unitLabel: unit?.label,
      label: input.label,
    };
    this.parkingSpaces.set(parkingSpace.id, parkingSpace);

    return { parkingSpace };
  }

  async listParkingSpaces(user: AuthenticatedUser, buildingId: string) {
    const building = this.getBuilding(buildingId);
    requireOrganizationAccess(user, building.organizationId);

    return {
      parkingSpaces: [...this.parkingSpaces.values()]
        .filter((parkingSpace) => parkingSpace.buildingId === buildingId)
        .sort(compareParkingSpaces),
    };
  }

  async registerResident(
    user: AuthenticatedUser,
    input: RegisterResidentInput,
  ): Promise<ResidentInvite> {
    const building = this.getBuilding(input.buildingId);
    requireOrganizationAccess(user, building.organizationId);
    if (input.unitId) {
      const unit = this.units.get(input.unitId);
      if (!unit || unit.buildingId !== building.id) {
        throw new BuildingError("UNIT_NOT_FOUND", 404);
      }
    }

    const personId = createId("per");
    this.persons.set(personId, {
      id: personId,
      organizationId: building.organizationId,
      buildingId: building.id,
      unitId: input.unitId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      documentNumber: input.documentNumber,
    });

    if (!input.email) {
      return { personId };
    }

    const userId = createId("usr");
    const activationToken = createOpaqueToken();
    this.users.set(userId, {
      id: userId,
      email: input.email.toLowerCase(),
      displayName: `${input.firstName} ${input.lastName}`,
    });

    return { personId, userId, activationToken };
  }

  async listResidents(user: AuthenticatedUser, buildingId: string) {
    const building = this.getBuilding(buildingId);
    requireOrganizationAccess(user, building.organizationId);

    const residents = [...this.persons.values()]
      .filter((person) => person.buildingId === buildingId)
      .map((person) => {
        const unit = person.unitId ? this.units.get(person.unitId) : undefined;
        return {
          personId: person.id,
          buildingId,
          unitId: person.unitId,
          unitLabel: unit?.label,
          firstName: person.firstName,
          lastName: person.lastName,
          email: person.email,
          phone: person.phone,
          documentNumber: person.documentNumber,
        };
      })
      .sort(compareResidents);

    return { residents };
  }

  private getBuilding(buildingId: string): BuildingSummary {
    const building = this.buildings.get(buildingId);
    if (!building) {
      throw new BuildingError("BUILDING_NOT_FOUND", 404);
    }

    return building;
  }

  private getFloor(floorId: string, buildingId: string): FloorSummary {
    const floor = this.floors.get(floorId);
    if (!floor || floor.buildingId !== buildingId) {
      throw new BuildingError("FLOOR_NOT_FOUND", 404);
    }

    return floor;
  }

  private getUnit(unitId: string, buildingId: string): UnitSummary {
    const unit = this.units.get(unitId);
    if (!unit || unit.buildingId !== buildingId) {
      throw new BuildingError("UNIT_NOT_FOUND", 404);
    }

    return unit;
  }
}

export class PrismaBuildingStore implements BuildingStore {
  constructor(private readonly client: PrismaClient = prisma) {}

  async createBuilding(user: AuthenticatedUser, input: CreateBuildingInput) {
    requireOrganizationAccess(user, input.organizationId);
    const building = await this.client.building.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        address: input.address,
        timezone: input.timezone,
      },
    });

    return { building };
  }

  async listBuildings(user: AuthenticatedUser, organizationId: string) {
    requireOrganizationAccess(user, organizationId);
    const buildings = await this.client.building.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });

    return { buildings };
  }

  async createUnit(user: AuthenticatedUser, input: CreateUnitInput) {
    const building = await this.client.building.findUnique({
      where: { id: input.buildingId },
    });
    if (!building) {
      throw new BuildingError("BUILDING_NOT_FOUND", 404);
    }
    requireOrganizationAccess(user, building.organizationId);

    const floor = input.floorId
      ? await this.client.floor.findUnique({ where: { id: input.floorId } })
      : undefined;
    if (input.floorId && (!floor || floor.buildingId !== building.id)) {
      throw new BuildingError("FLOOR_NOT_FOUND", 404);
    }

    const unit = await this.client.unit.create({
      data: {
        organizationId: building.organizationId,
        buildingId: building.id,
        floorId: input.floorId,
        label: input.label,
      },
    });

    return { unit: { ...unit, floorName: floor?.name } };
  }

  async createFloor(user: AuthenticatedUser, input: CreateFloorInput) {
    const building = await this.client.building.findUnique({
      where: { id: input.buildingId },
    });
    if (!building) {
      throw new BuildingError("BUILDING_NOT_FOUND", 404);
    }
    requireOrganizationAccess(user, building.organizationId);

    const floor = await this.client.floor.create({
      data: {
        organizationId: building.organizationId,
        buildingId: building.id,
        name: input.name,
        sortOrder: input.sortOrder,
      },
    });

    return { floor };
  }

  async listFloors(user: AuthenticatedUser, buildingId: string) {
    const building = await this.client.building.findUnique({
      where: { id: buildingId },
    });
    if (!building) {
      throw new BuildingError("BUILDING_NOT_FOUND", 404);
    }
    requireOrganizationAccess(user, building.organizationId);

    const floors = await this.client.floor.findMany({
      where: { buildingId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return { floors };
  }

  async listUnits(user: AuthenticatedUser, buildingId: string) {
    const building = await this.client.building.findUnique({
      where: { id: buildingId },
    });
    if (!building) {
      throw new BuildingError("BUILDING_NOT_FOUND", 404);
    }
    requireOrganizationAccess(user, building.organizationId);

    const units = await this.client.unit.findMany({
      include: { floor: true },
      where: { buildingId },
      orderBy: { label: "asc" },
    });

    return {
      units: units.map((unit) => ({
        id: unit.id,
        organizationId: unit.organizationId,
        buildingId: unit.buildingId,
        label: unit.label,
        floorId: unit.floorId,
        floorName: unit.floor?.name,
      })),
    };
  }

  async createParkingSpace(
    user: AuthenticatedUser,
    input: CreateParkingSpaceInput,
  ) {
    const building = await this.client.building.findUnique({
      where: { id: input.buildingId },
    });
    if (!building) {
      throw new BuildingError("BUILDING_NOT_FOUND", 404);
    }
    requireOrganizationAccess(user, building.organizationId);

    const floor = input.floorId
      ? await this.client.floor.findUnique({ where: { id: input.floorId } })
      : undefined;
    if (input.floorId && (!floor || floor.buildingId !== building.id)) {
      throw new BuildingError("FLOOR_NOT_FOUND", 404);
    }

    const unit = input.unitId
      ? await this.client.unit.findUnique({ where: { id: input.unitId } })
      : undefined;
    if (input.unitId && (!unit || unit.buildingId !== building.id)) {
      throw new BuildingError("UNIT_NOT_FOUND", 404);
    }

    const parkingSpace = await this.client.parkingSpace.create({
      data: {
        organizationId: building.organizationId,
        buildingId: building.id,
        floorId: floor?.id,
        unitId: unit?.id,
        label: input.label,
      },
    });

    return {
      parkingSpace: {
        ...parkingSpace,
        floorName: floor?.name,
        unitLabel: unit?.label,
      },
    };
  }

  async listParkingSpaces(user: AuthenticatedUser, buildingId: string) {
    const building = await this.client.building.findUnique({
      where: { id: buildingId },
    });
    if (!building) {
      throw new BuildingError("BUILDING_NOT_FOUND", 404);
    }
    requireOrganizationAccess(user, building.organizationId);

    const parkingSpaces = await this.client.parkingSpace.findMany({
      include: {
        floor: true,
        unit: true,
      },
      where: { buildingId },
      orderBy: { label: "asc" },
    });

    return {
      parkingSpaces: parkingSpaces.map((parkingSpace) => ({
        id: parkingSpace.id,
        organizationId: parkingSpace.organizationId,
        buildingId: parkingSpace.buildingId,
        floorId: parkingSpace.floorId,
        floorName: parkingSpace.floor?.name,
        unitId: parkingSpace.unitId,
        unitLabel: parkingSpace.unit?.label,
        label: parkingSpace.label,
      })),
    };
  }

  async registerResident(
    user: AuthenticatedUser,
    input: RegisterResidentInput,
  ): Promise<ResidentInvite> {
    const building = await this.client.building.findUnique({
      where: { id: input.buildingId },
    });
    if (!building) {
      throw new BuildingError("BUILDING_NOT_FOUND", 404);
    }
    requireOrganizationAccess(user, building.organizationId);

    if (input.unitId) {
      const unit = await this.client.unit.findUnique({
        where: { id: input.unitId },
      });
      if (!unit || unit.buildingId !== building.id) {
        throw new BuildingError("UNIT_NOT_FOUND", 404);
      }
    }

    const result = await this.client.$transaction(async (transaction) => {
      const person = await transaction.person.create({
        data: {
          organizationId: building.organizationId,
          userId: undefined,
          firstName: input.firstName,
          lastName: input.lastName,
          documentNumber: input.documentNumber,
          email: input.email?.toLowerCase(),
          phone: input.phone,
        },
      });
      await transaction.buildingMembership.create({
        data: {
          organizationId: building.organizationId,
          buildingId: building.id,
          unitId: input.unitId,
          personId: person.id,
          role: "RESIDENT",
        },
      });

      if (!input.email) {
        return { personId: person.id };
      }

      const residentUser = await transaction.user.create({
        data: {
          organizationId: building.organizationId,
          email: input.email.toLowerCase(),
          displayName: `${input.firstName} ${input.lastName}`,
          isActive: false,
        },
      });
      await transaction.person.update({
        where: { id: person.id },
        data: { userId: residentUser.id },
      });
      await transaction.organizationMembership.create({
        data: {
          organizationId: building.organizationId,
          userId: residentUser.id,
          role: "RESIDENT",
        },
      });

      const activationToken = createOpaqueToken();
      await transaction.activationToken.create({
        data: {
          userId: residentUser.id,
          tokenHash: hashOpaqueToken(activationToken),
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });

      return {
        personId: person.id,
        userId: residentUser.id,
        activationToken,
      };
    });

    return result;
  }

  async listResidents(user: AuthenticatedUser, buildingId: string) {
    const building = await this.client.building.findUnique({
      where: { id: buildingId },
    });
    if (!building) {
      throw new BuildingError("BUILDING_NOT_FOUND", 404);
    }
    requireOrganizationAccess(user, building.organizationId);

    const memberships = await this.client.buildingMembership.findMany({
      include: {
        person: true,
        unit: true,
      },
      where: {
        buildingId,
        isActive: true,
        role: "RESIDENT",
      },
    });

    const residents = memberships
      .map((membership) => ({
        personId: membership.person.id,
        buildingId,
        unitId: membership.unitId,
        unitLabel: membership.unit?.label,
        firstName: membership.person.firstName,
        lastName: membership.person.lastName,
        email: membership.person.email,
        phone: membership.person.phone,
        documentNumber: membership.person.documentNumber,
      }))
      .sort(compareResidents);

    return { residents };
  }
}

export class BuildingError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(code);
  }
}

const createBuildingSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(2),
  address: z.string().min(2),
  timezone: z.string().min(2),
});

const createFloorSchema = z.object({
  buildingId: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number().int().default(0),
});

const createParkingSpaceSchema = z.object({
  buildingId: z.string().min(1),
  floorId: z.string().optional(),
  unitId: z.string().optional(),
  label: z.string().min(1),
});

const createUnitSchema = z.object({
  buildingId: z.string().min(1),
  label: z.string().min(1),
  floorId: z.string().optional(),
});

const registerResidentSchema = z.object({
  buildingId: z.string().min(1),
  unitId: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  documentNumber: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export async function registerBuildingRoutes(
  app: FastifyInstance,
  authStore: AuthStore,
  buildingStore: BuildingStore,
) {
  app.post("/api/v1/buildings", async (request) => {
    const user = await requireAuthenticated(authStore, request);
    const input = createBuildingSchema.parse(request.body);
    return buildingStore.createBuilding(user, input);
  });

  app.get(
    "/api/v1/organizations/:organizationId/buildings",
    async (request) => {
      const user = await requireAuthenticated(authStore, request);
      const params = z
        .object({ organizationId: z.string().min(1) })
        .parse(request.params);
      return buildingStore.listBuildings(user, params.organizationId);
    },
  );

  app.post("/api/v1/units", async (request) => {
    const user = await requireAuthenticated(authStore, request);
    const input = createUnitSchema.parse(request.body);
    return buildingStore.createUnit(user, input);
  });

  app.post("/api/v1/floors", async (request) => {
    const user = await requireAuthenticated(authStore, request);
    const input = createFloorSchema.parse(request.body);
    return buildingStore.createFloor(user, input);
  });

  app.get("/api/v1/buildings/:buildingId/floors", async (request) => {
    const user = await requireAuthenticated(authStore, request);
    const params = z
      .object({ buildingId: z.string().min(1) })
      .parse(request.params);
    return buildingStore.listFloors(user, params.buildingId);
  });

  app.get("/api/v1/buildings/:buildingId/units", async (request) => {
    const user = await requireAuthenticated(authStore, request);
    const params = z
      .object({ buildingId: z.string().min(1) })
      .parse(request.params);
    return buildingStore.listUnits(user, params.buildingId);
  });

  app.post("/api/v1/parking-spaces", async (request) => {
    const user = await requireAuthenticated(authStore, request);
    const input = createParkingSpaceSchema.parse(request.body);
    return buildingStore.createParkingSpace(user, input);
  });

  app.get("/api/v1/buildings/:buildingId/parking-spaces", async (request) => {
    const user = await requireAuthenticated(authStore, request);
    const params = z
      .object({ buildingId: z.string().min(1) })
      .parse(request.params);
    return buildingStore.listParkingSpaces(user, params.buildingId);
  });

  app.post("/api/v1/residents", async (request) => {
    const user = await requireAuthenticated(authStore, request);
    const input = registerResidentSchema.parse(request.body);
    return buildingStore.registerResident(user, input);
  });

  app.get("/api/v1/buildings/:buildingId/residents", async (request) => {
    const user = await requireAuthenticated(authStore, request);
    const params = z
      .object({ buildingId: z.string().min(1) })
      .parse(request.params);
    return buildingStore.listResidents(user, params.buildingId);
  });
}

async function requireAuthenticated(
  authStore: AuthStore,
  request: Parameters<typeof getAuthenticatedUser>[1],
): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser(authStore, request);
  if (!user) {
    throw new AuthError("UNAUTHENTICATED", 401);
  }

  return user;
}

function createId(prefix: string): string {
  return `${prefix}_${createOpaqueToken(12)}`;
}

function compareResidents(left: ResidentSummary, right: ResidentSummary) {
  return (
    left.lastName.localeCompare(right.lastName) ||
    left.firstName.localeCompare(right.firstName) ||
    left.personId.localeCompare(right.personId)
  );
}

function compareFloors(left: FloorSummary, right: FloorSummary) {
  return (
    left.sortOrder - right.sortOrder ||
    left.name.localeCompare(right.name) ||
    left.id.localeCompare(right.id)
  );
}

function compareParkingSpaces(
  left: ParkingSpaceSummary,
  right: ParkingSpaceSummary,
) {
  return (
    left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
  );
}
