import prisma from "../../utils/prisma.js";
import { validateStructuredAddress } from "../../utils/address-validation.js";

export const listClients = async (isActive?: boolean) => {
  return await prisma.client.findMany({
    where: isActive !== undefined ? { isActive } : undefined,
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
}) => {
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

export const updateClient = async (
  id: number,
  data: {
    name?: string;
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
    isActive?: boolean;
    reviewThresholdDays?: number;
    medicalValidityMonths?: number;
  }
) => {
  const current = await prisma.client.findUnique({ where: { id } });
  if (!current) throw new Error("Client not found");
  validateStructuredAddress(data, current);

  const structuredAddressKeys = ["street", "barangay", "city", "province", "postalCode"] as const;
  const structuredAddressChanged = structuredAddressKeys.some((key) =>
    Object.prototype.hasOwnProperty.call(data, key) && (data[key] ?? null) !== (current[key] ?? null)
  );
  let compositeAddress: string | null | undefined = data.address;
  if (compositeAddress === undefined && structuredAddressChanged) {
    compositeAddress = [
      data.street ?? current.street,
      data.barangay ?? current.barangay,
      data.city ?? current.city,
      data.province ?? current.province,
      data.postalCode ?? current.postalCode,
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
