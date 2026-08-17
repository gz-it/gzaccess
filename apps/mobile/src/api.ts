import type { Building, Resident, Tokens, User, Vehicle } from "./types";

const fallbackApiBaseUrl = "http://localhost:4000/api/v1";
const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  fallbackApiBaseUrl;

export interface ApiError extends Error {
  code?: string;
}

export async function login(input: {
  email: string;
  password: string;
  mfaCode?: string;
}): Promise<{ user: User; tokens: Tokens }> {
  return apiPost("/auth/login", {
    email: input.email,
    password: input.password,
    mfaCode: input.mfaCode || undefined,
  });
}

export async function activateAccount(input: {
  token: string;
  password: string;
}): Promise<{ user: User; tokens: Tokens }> {
  return apiPost("/auth/activation/complete", input);
}

export async function requestPasswordReset(
  email: string,
): Promise<{ resetToken?: string }> {
  return apiPost("/auth/password-reset/request", { email });
}

export async function getCurrentUser(
  accessToken: string,
): Promise<{ user: User }> {
  return apiGet("/auth/me", accessToken);
}

export async function listBuildings(
  accessToken: string,
  organizationId: string,
): Promise<{ buildings: Building[] }> {
  return apiGet(`/organizations/${organizationId}/buildings`, accessToken);
}

export async function listResidents(
  accessToken: string,
  buildingId: string,
): Promise<{ residents: Resident[] }> {
  return apiGet(`/buildings/${buildingId}/residents`, accessToken);
}

export async function getResidentProfile(
  accessToken: string,
): Promise<{ residents: Resident[] }> {
  return apiGet("/resident-profile", accessToken);
}

export async function listVehicles(
  accessToken: string,
  buildingId: string,
): Promise<{ vehicles: Vehicle[] }> {
  return apiGet(`/buildings/${buildingId}/vehicles`, accessToken);
}

export async function createVehicle(
  accessToken: string,
  input: {
    buildingId: string;
    personId: string;
    plate: string;
    country: string;
    brand?: string;
    model?: string;
    color?: string;
    type?: string;
  },
): Promise<{ vehicle: Vehicle }> {
  return apiPostWithAuth("/vehicles", input, accessToken);
}

async function apiGet<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  return parseApiResponse<T>(response);
}

async function apiPost<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  return parseApiResponse<T>(response);
}

async function apiPostWithAuth<T>(
  path: string,
  payload: unknown,
  accessToken: string,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    body: JSON.stringify(payload),
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  });

  return parseApiResponse<T>(response);
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) {
    const error = new Error(body.error ?? "API_ERROR") as ApiError;
    error.code = body.error ?? "API_ERROR";
    throw error;
  }

  return body as T;
}
