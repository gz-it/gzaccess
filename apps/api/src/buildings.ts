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
}

export interface ResidentInvite {
  personId: string;
  userId?: string;
  activationToken?: string;
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
  createUnit(
    user: AuthenticatedUser,
    input: CreateUnitInput,
  ): Promise<{ unit: UnitSummary }>;
  registerResident(
    user: AuthenticatedUser,
    input: RegisterResidentInput,
  ): Promise<ResidentInvite>;
}

type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
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
    const unit: UnitSummary = {
      id: createId("unt"),
      organizationId: building.organizationId,
      buildingId: building.id,
      label: input.label,
      floorId: input.floorId,
    };
    this.units.set(unit.id, unit);

    return { unit };
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

  private getBuilding(buildingId: string): BuildingSummary {
    const building = this.buildings.get(buildingId);
    if (!building) {
      throw new BuildingError("BUILDING_NOT_FOUND", 404);
    }

    return building;
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

    const unit = await this.client.unit.create({
      data: {
        organizationId: building.organizationId,
        buildingId: building.id,
        floorId: input.floorId,
        label: input.label,
      },
    });

    return { unit };
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

  app.post("/api/v1/residents", async (request) => {
    const user = await requireAuthenticated(authStore, request);
    const input = registerResidentSchema.parse(request.body);
    return buildingStore.registerResident(user, input);
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
