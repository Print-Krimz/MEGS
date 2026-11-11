import prisma from "../../utils/prisma.js";
import { validateStructuredAddress } from "../../utils/address-validation.js";
import { ownedWhere, type Actor } from "./ownership.js";
import { normalizeCompanyName } from "../../utils/company-name.js";
import { logAudit } from "../../utils/audit.js";

export type DuplicateClientMatch = { id: number; name: string; yours: boolean };

export class DuplicateClientError extends Error {
  statusCode = 409;
  field = "name";
  constructor(public match: DuplicateClientMatch) {
    super(`A client named "${match.name}" already exists.${match.yours ? "" : " Ask an Admin to assign it to you."}`);
    this.name = "DuplicateClientError";
  }
}

// Looks at every client, not only the actor's own, so a TA cannot re-create another TA's client.
export const findDuplicateClient = async (
  { name, tradeName }: { name?: string | null; tradeName?: string | null },
  actor?: Actor,
  excludeId?: number,
): Promise<DuplicateClientMatch | null> => {
  const wanted = [name, tradeName].map((value) => normalizeCompanyName(value ?? "")).filter(Boolean);
  if (wanted.length === 0) return null;
  // shortcut: app-level check; two simultaneous creates can still both pass. Add a unique index on a normalized name column if that happens.
  const rows = await prisma.client.findMany({
    where: excludeId !== undefined ? { id: { not: excludeId } } : undefined,
    select: { id: true, name: true, tradeName: true, assignedTaId: true },
  });
  const row = rows.find((candidate) =>
    [candidate.name, candidate.tradeName].some((value) => value && wanted.includes(normalizeCompanyName(value))),
  );
  if (!row) return null;
  return { id: row.id, name: row.name, yours: !actor || actor.role !== "TALENT_ACQUISITION" || row.assignedTaId === actor.id };
};

export const listClients = async (isActive?: boolean, actor?: Actor) => {
  const where = { ...(isActive !== undefined ? { isActive } : {}), ...(actor ? ownedWhere.client(actor) : {}) };
  return await prisma.client.findMany({
    where: Object.keys(where).length ? where : undefined,
    include: {
      _count: {
        select: {
          manpowerRequests: true,
          deployments: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const createClient = async (data: {
  name: string;
  tradeName?: string;
  industry?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  street?: string;
  barangay?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  reviewThresholdDays?: number;
  medicalValidityMonths?: number;
}, actor?: Actor) => {
  validateStructuredAddress(data);
  const duplicate = await findDuplicateClient(data, actor);
  if (duplicate) throw new DuplicateClientError(duplicate);
  // Construct composite address if individual fields are provided and composite is not
  let compositeAddress: string | null | undefined = data.address;
  if (!compositeAddress && (data.street || data.barangay || data.city || data.province || data.postalCode)) {
    compositeAddress = [data.street, data.barangay, data.city, data.province, data.postalCode]
      .filter(Boolean)
      .join(", ");
  }

  const client = await prisma.client.create({
    data: {
      name: data.name,
      tradeName: data.tradeName,
      industry: data.industry,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      address: compositeAddress,
      street: data.street,
      barangay: data.barangay,
      city: data.city,
      province: data.province,
      postalCode: data.postalCode,
      ...(actor?.role === "TALENT_ACQUISITION" ? { assignedTaId: actor.id } : {}),
      ...(data.reviewThresholdDays !== undefined ? { reviewThresholdDays: Number(data.reviewThresholdDays) } : {}),
      ...(data.medicalValidityMonths !== undefined ? { medicalValidityMonths: Number(data.medicalValidityMonths) } : {}),
    },
  });
  if (actor) void logAudit(actor.id, "CLIENT_CREATED", "Client", client.id, { name: client.name });
  return client;
};

export const getClientDetails = async (id: number) => {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      complianceTemplates: true,
      manpowerRequests: {
        include: {
          _count: { select: { jobPostings: true, deployments: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      deployments: {
        include: {
          application: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  applicantProfile: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!client) throw new Error("Client not found");
  return client;
};

// Optional text the client edit may clear; a blank value is saved as null, never as "".
const OPTIONAL_CLIENT_TEXT_FIELDS = ["tradeName", "industry", "contactName", "contactEmail", "contactPhone", "address", "street", "barangay", "city", "province", "postalCode"] as const;

export const updateClient = async (
  id: number,
  input: {
    name?: string;
    tradeName?: string | null;
    industry?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    address?: string | null;
    street?: string | null;
    barangay?: string | null;
    city?: string | null;
    province?: string | null;
    postalCode?: string | null;
    isActive?: boolean;
    reviewThresholdDays?: number;
    medicalValidityMonths?: number;
  },
  actor?: Actor,
) => {
  // The schema rejects a blank name too; this guards direct callers because name is a required column.
  if (input.name !== undefined && !(input.name ?? "").trim()) throw new Error("Client name is required.");
  const data = { ...input };
  for (const field of OPTIONAL_CLIENT_TEXT_FIELDS) {
    const value = data[field];
    if (typeof value === "string" && value.trim() === "") data[field] = null;
  }

  const current = await prisma.client.findUnique({ where: { id } });
  if (!current) throw new Error("Client not found");
  validateStructuredAddress(data, current);

  const nameChanged = data.name !== undefined && data.name !== current.name;
  const tradeNameChanged = data.tradeName !== undefined && (data.tradeName ?? null) !== (current.tradeName ?? null);
  if (nameChanged || tradeNameChanged) {
    const duplicate = await findDuplicateClient(
      { name: nameChanged ? data.name : null, tradeName: tradeNameChanged ? data.tradeName : null },
      actor,
      id,
    );
    if (duplicate) throw new DuplicateClientError(duplicate);
  }

  const structuredAddressKeys = ["street", "barangay", "city", "province", "postalCode"] as const;
  const structuredAddressChanged = structuredAddressKeys.some((key) =>
    Object.prototype.hasOwnProperty.call(data, key) && (data[key] ?? null) !== (current[key] ?? null)
  );
  let compositeAddress: string | null | undefined = data.address;
  if (compositeAddress === undefined && structuredAddressChanged) {
    // A cleared field (null) must not fall back to the stored value.
    compositeAddress = [
      data.street !== undefined ? data.street : current.street,
      data.barangay !== undefined ? data.barangay : current.barangay,
      data.city !== undefined ? data.city : current.city,
      data.province !== undefined ? data.province : current.province,
      data.postalCode !== undefined ? data.postalCode : current.postalCode,
    ].filter(Boolean).join(", ") || null;
  }

  const { reviewThresholdDays, medicalValidityMonths, ...rest } = data;

  return await prisma.client.update({
    where: { id },
    data: {
      ...rest,
      ...(compositeAddress !== undefined ? { address: compositeAddress } : {}),
      ...(reviewThresholdDays !== undefined ? { reviewThresholdDays: Number(reviewThresholdDays) } : {}),
      ...(medicalValidityMonths !== undefined ? { medicalValidityMonths: Number(medicalValidityMonths) } : {}),
    },
  });
};
