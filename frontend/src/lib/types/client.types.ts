export interface Client {
  id: number;
  name: string;
  tradeName?: string | null;
  industry?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  street?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    manpowerRequests: number;
    deployments: number;
  };
}

export interface CreateClientDto {
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
}

export interface UpdateClientDto extends Partial<CreateClientDto> {
  isActive?: boolean;
}
