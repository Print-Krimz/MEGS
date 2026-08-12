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
  industry?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
}) => {
  return await prisma.client.create({
    data: {
      name: data.name,
      industry: data.industry,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      address: data.address,
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
    industry?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    isActive?: boolean;
  }
) => {
  return await prisma.client.update({
    where: { id },
    data,
  });
};
