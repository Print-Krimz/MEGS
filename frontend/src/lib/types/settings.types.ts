import type { Role } from "./enums";

export interface AccountSettings {
  account: {
    id: string;
    role: Role;
    name: string | null;
    email: string | null;
    phoneNumber: string | null;
  };
  mfa: { required: boolean; enrolled: boolean | null } | null;
}

export interface UpdateStaffProfileRequest {
  displayName: string;
}
