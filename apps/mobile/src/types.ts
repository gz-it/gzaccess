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
