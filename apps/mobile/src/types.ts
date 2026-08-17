export interface User {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  organizationIds: string[];
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface Building {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  timezone: string;
}

export interface Resident {
  personId: string;
  buildingId: string;
  unitId?: string | null;
  unitLabel?: string | null;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  documentNumber?: string | null;
}

export interface Vehicle {
  id: string;
  buildingId: string;
  personId: string;
  residentName: string;
  plateOriginal: string;
  plateNormalized: string;
  country: string;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  type?: string | null;
  state: string;
}
