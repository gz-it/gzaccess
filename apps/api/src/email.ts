import { randomUUID } from "node:crypto";
import type { AuthenticatedUser } from "@gzaccess/contracts";
import { prisma, type PrismaClient } from "@gzaccess/database";

export interface ResidentActivationEmailInput {
  organizationId: string;
  buildingId: string;
  recipientEmail: string;
  displayName: string;
  activationToken: string;
}

export interface EmailOutboxItem {
  id: string;
  organizationId: string;
  buildingId: string;
  recipientEmail: string;
  subject: string;
  template: string;
  status: string;
  createdAt: string;
  sentAt?: string | null;
  safeError?: string | null;
}

export interface EmailOutboxStore {
  queueResidentActivation(
    input: ResidentActivationEmailInput,
  ): Promise<{ emailId: string }>;
  listBuildingOutbox(
    user: AuthenticatedUser,
    buildingId: string,
  ): Promise<{ emails: EmailOutboxItem[] }>;
}

interface StoredEmailOutboxItem extends EmailOutboxItem {
  payload: Record<string, string>;
}

export class InMemoryEmailOutboxStore implements EmailOutboxStore {
  private readonly emails = new Map<string, StoredEmailOutboxItem>();

  async queueResidentActivation(input: ResidentActivationEmailInput) {
    const id = createId("eml");
    const email = buildResidentActivationEmail(id, input);
    this.emails.set(id, email);

    return { emailId: id };
  }

  async listBuildingOutbox(user: AuthenticatedUser, buildingId: string) {
    const organizationIds = new Set(user.organizationIds);
    const emails = [...this.emails.values()]
      .filter(
        (email) =>
          email.buildingId === buildingId &&
          organizationIds.has(email.organizationId),
      )
      .sort(compareEmailOutboxItems)
      .map(stripPayload);

    return { emails };
  }
}

export class PrismaEmailOutboxStore implements EmailOutboxStore {
  constructor(private readonly client: PrismaClient = prisma) {}

  async queueResidentActivation(input: ResidentActivationEmailInput) {
    const email = buildResidentActivationEmail(undefined, input);
    const queued = await this.client.emailOutbox.create({
      data: {
        organizationId: email.organizationId,
        buildingId: email.buildingId,
        recipientEmail: email.recipientEmail,
        subject: email.subject,
        template: email.template,
        payload: email.payload,
        status: email.status,
      },
    });

    return { emailId: queued.id };
  }

  async listBuildingOutbox(user: AuthenticatedUser, buildingId: string) {
    const emails = await this.client.emailOutbox.findMany({
      where: {
        buildingId,
        organizationId: { in: user.organizationIds },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      emails: emails.map((email) => ({
        id: email.id,
        organizationId: email.organizationId,
        buildingId: email.buildingId,
        recipientEmail: email.recipientEmail,
        subject: email.subject,
        template: email.template,
        status: email.status,
        createdAt: email.createdAt.toISOString(),
        sentAt: email.sentAt?.toISOString(),
        safeError: email.safeError,
      })),
    };
  }
}

function buildResidentActivationEmail(
  id: string | undefined,
  input: ResidentActivationEmailInput,
): StoredEmailOutboxItem {
  return {
    id: id ?? "",
    organizationId: input.organizationId,
    buildingId: input.buildingId,
    recipientEmail: input.recipientEmail.toLowerCase(),
    subject: "Activa tu acceso a GzAccess",
    template: "resident_activation",
    payload: {
      activationLink: createActivationLink(input.activationToken),
      displayName: input.displayName,
    },
    status: "QUEUED",
    createdAt: new Date().toISOString(),
  };
}

function createActivationLink(activationToken: string): string {
  const baseUrl = process.env.PUBLIC_WEB_URL ?? "http://localhost:5173";
  return `${baseUrl.replace(/\/$/, "")}/activate?token=${encodeURIComponent(
    activationToken,
  )}`;
}

function stripPayload(email: StoredEmailOutboxItem): EmailOutboxItem {
  return {
    id: email.id,
    organizationId: email.organizationId,
    buildingId: email.buildingId,
    recipientEmail: email.recipientEmail,
    subject: email.subject,
    template: email.template,
    status: email.status,
    createdAt: email.createdAt,
    sentAt: email.sentAt,
    safeError: email.safeError,
  };
}

function compareEmailOutboxItems(
  left: EmailOutboxItem,
  right: EmailOutboxItem,
) {
  return (
    right.createdAt.localeCompare(left.createdAt) ||
    right.id.localeCompare(left.id)
  );
}

function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}
