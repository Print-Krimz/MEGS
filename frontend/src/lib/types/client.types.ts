export interface Client {
  id: number;
  name: string;
  industry?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
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
  industry?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
}

export interface UpdateClientDto extends Partial<CreateClientDto> {
  isActive?: boolean;
}
