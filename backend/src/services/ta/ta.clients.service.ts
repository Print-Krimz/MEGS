import prisma from "../../utils/prisma.js";

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
  city?: string;
  province?: string;
  postalCode?: string;
}) => {
  // Construct composite address if individual fields are provided and composite is not
  let compositeAddress = data.address;
  if (!compositeAddress && (data.street || data.city || data.province || data.postalCode)) {
    compositeAddress = [data.street, data.city, data.province, data.postalCode]
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
      city: data.city,
      province: data.province,
      postalCode: data.postalCode,
    },
  });
};

export const getClientDetails = async (id: number) => {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
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
    city?: string;
    province?: string;
    postalCode?: string;
    isActive?: boolean;
  }
) => {
  let compositeAddress = data.address;
  if (!compositeAddress && (data.street || data.city || data.province || data.postalCode)) {
    compositeAddress = [data.street, data.city, data.province, data.postalCode]
      .filter(Boolean)
      .join(", ");
  }

  return await prisma.client.update({
    where: { id },
    data: {
      ...data,
      ...(compositeAddress !== undefined ? { address: compositeAddress } : {}),
    },
  });
};
