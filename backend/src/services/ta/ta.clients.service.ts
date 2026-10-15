import prisma from "../../utils/prisma.js";
import { validateStructuredAddress } from "../../utils/address-validation.js";
import { ownedWhere, type Actor } from "./ownership.js";

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
  // Construct composite address if individual fields are provided and composite is not
  let compositeAddress: string | null | undefined = data.address;
  if (!compositeAddress && (data.street || data.barangay || data.city || data.province || data.postalCode)) {
    compositeAddress = [data.street, data.barangay, data.city, data.province, data.postalCode]
      .filter(Boolean)
      .join(", ");
  }

  return await prisma.client.create({
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
  }
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
