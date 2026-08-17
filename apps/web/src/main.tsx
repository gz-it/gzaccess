import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type AuthMode = "login" | "activation" | "reset-request" | "reset-complete";

interface User {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  organizationIds: string[];
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

interface Building {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  timezone: string;
}

interface Unit {
  id: string;
  buildingId: string;
  label: string;
  floorId?: string | null;
  floorName?: string | null;
}

interface Floor {
  id: string;
  buildingId: string;
  name: string;
  sortOrder: number;
}

interface ParkingSpace {
  id: string;
  buildingId: string;
  floorId?: string | null;
  floorName?: string | null;
  unitId?: string | null;
  unitLabel?: string | null;
  label: string;
}

interface Resident {
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

const apiBaseUrl = "/api/v1";
const accessTokenKey = "gzaccess.accessToken";
const refreshTokenKey = "gzaccess.refreshToken";

function App() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [user, setUser] = useState<User | undefined>();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [parkingSpaces, setParkingSpaces] = useState<ParkingSpace[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(accessTokenKey);
    if (!token) {
      return;
    }

    void loadCurrentUser(token, setUser, setStatus);
  }, []);

  useEffect(() => {
    if (!user?.organizationIds[0]) {
      setBuildings([]);
      setFloors([]);
      setUnits([]);
      setParkingSpaces([]);
      setResidents([]);
      setSelectedBuildingId("");
      return;
    }

    void loadBuildings(
      user.organizationIds[0],
      setBuildings,
      setSelectedBuildingId,
      setStatus,
    );
  }, [user]);

  useEffect(() => {
    if (!selectedBuildingId) {
      setFloors([]);
      setUnits([]);
      setParkingSpaces([]);
      setResidents([]);
      return;
    }

    void loadFloors(selectedBuildingId, setFloors, setStatus);
    void loadUnits(selectedBuildingId, setUnits, setStatus);
    void loadParkingSpaces(selectedBuildingId, setParkingSpaces, setStatus);
    void loadResidents(selectedBuildingId, setResidents, setStatus);
  }, [selectedBuildingId]);

  const navLabel = useMemo(() => {
    if (!user) {
      return "Acceso";
    }

    return user.roles.includes("GZIT_PLATFORM_ADMIN")
      ? "Plataforma"
      : "Operacion";
  }, [user]);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setStatus("");

    try {
      const response = await apiPost<{
        user: User;
        tokens: Tokens;
      }>("/auth/login", {
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      persistTokens(response.tokens);
      setUser(response.user);
      setStatus("Sesion iniciada");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitActivation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setStatus("");

    try {
      const response = await apiPost<{
        user: User;
        tokens: Tokens;
      }>("/auth/activation/complete", {
        token: String(form.get("token")),
        password: String(form.get("password")),
      });
      persistTokens(response.tokens);
      setUser(response.user);
      setStatus("Cuenta activada");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setStatus("");

    try {
      const response = await apiPost<{ resetToken?: string }>(
        "/auth/password-reset/request",
        {
          email: String(form.get("email")),
        },
      );
      setStatus(response.resetToken ?? "Solicitud registrada");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitResetComplete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setStatus("");

    try {
      await apiPost("/auth/password-reset/complete", {
        token: String(form.get("token")),
        password: String(form.get("password")),
      });
      setMode("login");
      setStatus("Password actualizado");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem(accessTokenKey);
    localStorage.removeItem(refreshTokenKey);
    setUser(undefined);
    setBuildings([]);
    setFloors([]);
    setUnits([]);
    setParkingSpaces([]);
    setResidents([]);
    setSelectedBuildingId("");
    setStatus("");
  }

  async function submitBuilding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.organizationIds[0]) {
      return;
    }

    const form = new FormData(event.currentTarget);
    setBusy(true);
    setStatus("");

    try {
      const response = await apiPostWithAuth<{ building: Building }>(
        "/buildings",
        {
          organizationId: user.organizationIds[0],
          name: String(form.get("name")),
          address: String(form.get("address")),
          timezone: String(form.get("timezone")),
        },
      );
      setBuildings((current) => [...current, response.building]);
      setUnits([]);
      setSelectedBuildingId(response.building.id);
      setStatus("Edificio creado");
      event.currentTarget.reset();
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const buildingId = String(form.get("buildingId") || selectedBuildingId);
    if (!buildingId) {
      setStatus("BUILDING_REQUIRED");
      return;
    }

    setBusy(true);
    setStatus("");

    try {
      const response = await apiPostWithAuth<{ unit: Unit }>("/units", {
        buildingId,
        floorId: String(form.get("floorId") || "") || undefined,
        label: String(form.get("label")),
      });
      setUnits((current) =>
        current.some((unit) => unit.id === response.unit.id)
          ? current
          : [...current, response.unit],
      );
      setStatus("Unidad creada");
      event.currentTarget.reset();
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitFloor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const buildingId = String(form.get("buildingId") || selectedBuildingId);
    if (!buildingId) {
      setStatus("BUILDING_REQUIRED");
      return;
    }

    setBusy(true);
    setStatus("");

    try {
      const response = await apiPostWithAuth<{ floor: Floor }>("/floors", {
        buildingId,
        name: String(form.get("name")),
        sortOrder: Number(form.get("sortOrder") || 0),
      });
      setFloors((current) =>
        [...current, response.floor].sort(
          (left, right) =>
            left.sortOrder - right.sortOrder ||
            left.name.localeCompare(right.name),
        ),
      );
      setStatus("Piso creado");
      event.currentTarget.reset();
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitParkingSpace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const buildingId = String(form.get("buildingId") || selectedBuildingId);
    if (!buildingId) {
      setStatus("BUILDING_REQUIRED");
      return;
    }

    setBusy(true);
    setStatus("");

    try {
      const response = await apiPostWithAuth<{
        parkingSpace: ParkingSpace;
      }>("/parking-spaces", {
        buildingId,
        floorId: String(form.get("floorId") || "") || undefined,
        unitId: String(form.get("unitId") || "") || undefined,
        label: String(form.get("label")),
      });
      setParkingSpaces((current) =>
        [...current, response.parkingSpace].sort((left, right) =>
          left.label.localeCompare(right.label),
        ),
      );
      setStatus("Cochera creada");
      event.currentTarget.reset();
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitResidentImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBuildingId) {
      setStatus("BUILDING_REQUIRED");
      return;
    }

    const form = new FormData(event.currentTarget);
    const csv = String(form.get("csv") || "");
    const unitByLabel = new Map(
      units
        .filter((unit) => unit.buildingId === selectedBuildingId)
        .map((unit) => [unit.label.toLowerCase(), unit.id]),
    );
    const residents = parseResidentCsv(csv, unitByLabel);
    if (residents.length === 0) {
      setStatus("IMPORT_EMPTY");
      return;
    }

    setBusy(true);
    setStatus("");

    try {
      const response = await apiPostWithAuth<{
        importedCount: number;
        failedCount: number;
      }>("/residents/import", {
        buildingId: selectedBuildingId,
        residents,
      });
      await loadResidents(selectedBuildingId, setResidents, setStatus);
      setStatus(
        `Importados ${response.importedCount}; fallidos ${response.failedCount}`,
      );
      event.currentTarget.reset();
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitResident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const buildingId = String(form.get("buildingId") || selectedBuildingId);
    if (!buildingId) {
      setStatus("BUILDING_REQUIRED");
      return;
    }

    setBusy(true);
    setStatus("");

    try {
      const response = await apiPostWithAuth<{
        personId: string;
        activationToken?: string;
      }>("/residents", {
        buildingId,
        unitId: String(form.get("unitId") || "") || undefined,
        firstName: String(form.get("firstName")),
        lastName: String(form.get("lastName")),
        documentNumber: String(form.get("documentNumber") || "") || undefined,
        email: String(form.get("email") || "") || undefined,
        phone: String(form.get("phone") || "") || undefined,
      });
      await loadResidents(buildingId, setResidents, setStatus);
      setStatus(response.activationToken ?? `Residente ${response.personId}`);
      event.currentTarget.reset();
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Navegacion principal">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            GA
          </span>
          <span>GzAccess</span>
        </div>
        <nav>
          <button className="active" type="button">
            <span className="nav-dot" aria-hidden="true" />
            {navLabel}
          </button>
          {user ? (
            <button type="button" onClick={logout}>
              <span className="nav-dot" aria-hidden="true" />
              Salir
            </button>
          ) : null}
        </nav>
      </aside>
      <section className="workspace">
        <header>
          <p>{user ? "Sesion activa" : "Identidad"}</p>
          <h1>{user ? user.displayName : "GzAccess"}</h1>
        </header>

        {user ? (
          <div className="admin-layout">
            <section className="status-grid" aria-label="Sesion">
              <article>
                <span>Email</span>
                <strong>{user.email}</strong>
                <p>{user.roles.join(", ")}</p>
              </article>
              <article>
                <span>Organizaciones</span>
                <strong>{user.organizationIds.length}</strong>
                <p>{user.organizationIds.join(", ")}</p>
              </article>
              <article>
                <span>Estado</span>
                <strong>Autenticado</strong>
                <p>{status || "Token de acceso vigente"}</p>
              </article>
            </section>

            <section className="ops-grid" aria-label="Administracion">
              <Panel title="Edificio">
                <AdminForm
                  busy={busy}
                  submitLabel="Crear edificio"
                  onSubmit={submitBuilding}
                >
                  <Field label="Nombre" name="name" />
                  <Field label="Direccion" name="address" />
                  <Field
                    label="Zona horaria"
                    name="timezone"
                    defaultValue="America/Buenos_Aires"
                  />
                </AdminForm>
              </Panel>

              <Panel title="Unidad">
                <AdminForm
                  busy={busy}
                  submitLabel="Crear unidad"
                  onSubmit={submitUnit}
                >
                  <BuildingSelect
                    buildings={buildings}
                    selectedBuildingId={selectedBuildingId}
                    setSelectedBuildingId={setSelectedBuildingId}
                  />
                  <FloorSelect floors={floors} />
                  <Field label="Unidad" name="label" />
                </AdminForm>
              </Panel>

              <Panel title="Piso">
                <AdminForm
                  busy={busy}
                  submitLabel="Crear piso"
                  onSubmit={submitFloor}
                >
                  <BuildingSelect
                    buildings={buildings}
                    selectedBuildingId={selectedBuildingId}
                    setSelectedBuildingId={setSelectedBuildingId}
                  />
                  <div className="split-fields">
                    <Field label="Nombre" name="name" />
                    <Field
                      label="Orden"
                      name="sortOrder"
                      defaultValue="0"
                      type="number"
                    />
                  </div>
                </AdminForm>
              </Panel>

              <Panel title="Residente">
                <AdminForm
                  busy={busy}
                  submitLabel="Registrar residente"
                  onSubmit={submitResident}
                >
                  <BuildingSelect
                    buildings={buildings}
                    selectedBuildingId={selectedBuildingId}
                    setSelectedBuildingId={setSelectedBuildingId}
                  />
                  <UnitSelect units={units} buildingId={selectedBuildingId} />
                  <div className="split-fields">
                    <Field label="Nombre" name="firstName" />
                    <Field label="Apellido" name="lastName" />
                  </div>
                  <Field
                    label="Documento"
                    name="documentNumber"
                    required={false}
                  />
                  <Field
                    label="Email"
                    name="email"
                    required={false}
                    type="email"
                  />
                  <Field label="Telefono" name="phone" required={false} />
                </AdminForm>
              </Panel>

              <Panel title="Cochera">
                <AdminForm
                  busy={busy}
                  submitLabel="Crear cochera"
                  onSubmit={submitParkingSpace}
                >
                  <BuildingSelect
                    buildings={buildings}
                    selectedBuildingId={selectedBuildingId}
                    setSelectedBuildingId={setSelectedBuildingId}
                  />
                  <FloorSelect floors={floors} />
                  <UnitSelect units={units} buildingId={selectedBuildingId} />
                  <Field label="Etiqueta" name="label" />
                </AdminForm>
                <ParkingSpaceList parkingSpaces={parkingSpaces} />
              </Panel>

              <Panel title="Importar">
                <AdminForm
                  busy={busy}
                  submitLabel="Importar residentes"
                  onSubmit={submitResidentImport}
                >
                  <CsvField />
                </AdminForm>
              </Panel>

              <Panel title="Poblacion">
                <ResidentList residents={residents} />
              </Panel>
            </section>
          </div>
        ) : (
          <section className="auth-surface" aria-label="Autenticacion">
            <div className="mode-tabs">
              <ModeButton mode={mode} target="login" setMode={setMode}>
                Login
              </ModeButton>
              <ModeButton mode={mode} target="activation" setMode={setMode}>
                Activacion
              </ModeButton>
              <ModeButton mode={mode} target="reset-request" setMode={setMode}>
                Reset
              </ModeButton>
              <ModeButton mode={mode} target="reset-complete" setMode={setMode}>
                Nuevo password
              </ModeButton>
            </div>

            {mode === "login" ? (
              <AuthForm busy={busy} submitLabel="Entrar" onSubmit={submitLogin}>
                <Field label="Email" name="email" type="email" />
                <Field label="Password" name="password" type="password" />
              </AuthForm>
            ) : null}

            {mode === "activation" ? (
              <AuthForm
                busy={busy}
                submitLabel="Activar"
                onSubmit={submitActivation}
              >
                <Field label="Token" name="token" />
                <Field label="Password" name="password" type="password" />
              </AuthForm>
            ) : null}

            {mode === "reset-request" ? (
              <AuthForm
                busy={busy}
                submitLabel="Solicitar"
                onSubmit={submitResetRequest}
              >
                <Field label="Email" name="email" type="email" />
              </AuthForm>
            ) : null}

            {mode === "reset-complete" ? (
              <AuthForm
                busy={busy}
                submitLabel="Actualizar"
                onSubmit={submitResetComplete}
              >
                <Field label="Token" name="token" />
                <Field label="Password" name="password" type="password" />
              </AuthForm>
            ) : null}

            {status ? <p className="form-status">{status}</p> : null}
          </section>
        )}
      </section>
    </main>
  );
}

function ModeButton({
  children,
  mode,
  setMode,
  target,
}: {
  children: React.ReactNode;
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  target: AuthMode;
}) {
  return (
    <button
      className={mode === target ? "selected" : ""}
      type="button"
      onClick={() => setMode(target)}
    >
      {children}
    </button>
  );
}

function AuthForm({
  busy,
  children,
  onSubmit,
  submitLabel,
}: {
  busy: boolean;
  children: React.ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
}) {
  return (
    <form className="auth-form" onSubmit={onSubmit}>
      {children}
      <button disabled={busy} type="submit">
        {busy ? "Procesando" : submitLabel}
      </button>
    </form>
  );
}

function AdminForm({
  busy,
  children,
  onSubmit,
  submitLabel,
}: {
  busy: boolean;
  children: React.ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
}) {
  return (
    <form className="auth-form compact" onSubmit={onSubmit}>
      {children}
      <button disabled={busy} type="submit">
        {busy ? "Procesando" : submitLabel}
      </button>
    </form>
  );
}

function Panel({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Field({
  defaultValue,
  label,
  name,
  required = true,
  type = "text",
}: {
  defaultValue?: string;
  label: string;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        defaultValue={defaultValue}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

function CsvField() {
  return (
    <label>
      <span>CSV</span>
      <textarea
        name="csv"
        placeholder="nombre,apellido,email,documento,telefono,unidad"
        required
        rows={8}
      />
    </label>
  );
}

function BuildingSelect({
  buildings,
  selectedBuildingId,
  setSelectedBuildingId,
}: {
  buildings: Building[];
  selectedBuildingId: string;
  setSelectedBuildingId: (buildingId: string) => void;
}) {
  return (
    <label>
      <span>Edificio</span>
      <select
        name="buildingId"
        required
        value={selectedBuildingId}
        onChange={(event) => setSelectedBuildingId(event.target.value)}
      >
        <option value="">Seleccionar</option>
        {buildings.map((building) => (
          <option key={building.id} value={building.id}>
            {building.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function UnitSelect({
  buildingId,
  units,
}: {
  buildingId: string;
  units: Unit[];
}) {
  return (
    <label>
      <span>Unidad</span>
      <select name="unitId">
        <option value="">Sin unidad</option>
        {units
          .filter((unit) => unit.buildingId === buildingId)
          .map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.label}
              {unit.floorName ? ` - ${unit.floorName}` : ""}
            </option>
          ))}
      </select>
    </label>
  );
}

function FloorSelect({ floors }: { floors: Floor[] }) {
  return (
    <label>
      <span>Piso</span>
      <select name="floorId">
        <option value="">Sin piso</option>
        {floors.map((floor) => (
          <option key={floor.id} value={floor.id}>
            {floor.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ResidentList({ residents }: { residents: Resident[] }) {
  if (residents.length === 0) {
    return <p className="empty-state">Sin residentes cargados</p>;
  }

  return (
    <div className="resident-list">
      {residents.map((resident) => (
        <article className="resident-row" key={resident.personId}>
          <div>
            <strong>
              {resident.lastName}, {resident.firstName}
            </strong>
            <span>{resident.unitLabel ?? "Sin unidad"}</span>
          </div>
          <p>{resident.email ?? resident.phone ?? resident.documentNumber}</p>
        </article>
      ))}
    </div>
  );
}

function ParkingSpaceList({
  parkingSpaces,
}: {
  parkingSpaces: ParkingSpace[];
}) {
  if (parkingSpaces.length === 0) {
    return <p className="empty-state spaced">Sin cocheras cargadas</p>;
  }

  return (
    <div className="resident-list spaced">
      {parkingSpaces.map((parkingSpace) => (
        <article className="resident-row" key={parkingSpace.id}>
          <div>
            <strong>{parkingSpace.label}</strong>
            <span>{parkingSpace.unitLabel ?? "Sin unidad asociada"}</span>
          </div>
          <p>{parkingSpace.floorName ?? "Sin piso"}</p>
        </article>
      ))}
    </div>
  );
}

async function loadCurrentUser(
  accessToken: string,
  setUser: (user: User | undefined) => void,
  setStatus: (status: string) => void,
) {
  try {
    const response = await apiGet<{ user: User }>("/auth/me", accessToken);
    setUser(response.user);
  } catch {
    localStorage.removeItem(accessTokenKey);
    localStorage.removeItem(refreshTokenKey);
    setStatus("");
  }
}

async function loadBuildings(
  organizationId: string,
  setBuildings: (buildings: Building[]) => void,
  setSelectedBuildingId: (buildingId: string) => void,
  setStatus: (status: string) => void,
) {
  const accessToken = localStorage.getItem(accessTokenKey);
  if (!accessToken) {
    return;
  }

  try {
    const response = await apiGet<{ buildings: Building[] }>(
      `/organizations/${organizationId}/buildings`,
      accessToken,
    );
    setBuildings(response.buildings);
    setSelectedBuildingId(response.buildings[0]?.id ?? "");
  } catch (error) {
    setStatus(getErrorMessage(error));
  }
}

async function loadUnits(
  buildingId: string,
  setUnits: (units: Unit[]) => void,
  setStatus: (status: string) => void,
) {
  const accessToken = localStorage.getItem(accessTokenKey);
  if (!accessToken) {
    return;
  }

  try {
    const response = await apiGet<{ units: Unit[] }>(
      `/buildings/${buildingId}/units`,
      accessToken,
    );
    setUnits(response.units);
  } catch (error) {
    setStatus(getErrorMessage(error));
  }
}

async function loadFloors(
  buildingId: string,
  setFloors: (floors: Floor[]) => void,
  setStatus: (status: string) => void,
) {
  const accessToken = localStorage.getItem(accessTokenKey);
  if (!accessToken) {
    return;
  }

  try {
    const response = await apiGet<{ floors: Floor[] }>(
      `/buildings/${buildingId}/floors`,
      accessToken,
    );
    setFloors(response.floors);
  } catch (error) {
    setStatus(getErrorMessage(error));
  }
}

async function loadParkingSpaces(
  buildingId: string,
  setParkingSpaces: (parkingSpaces: ParkingSpace[]) => void,
  setStatus: (status: string) => void,
) {
  const accessToken = localStorage.getItem(accessTokenKey);
  if (!accessToken) {
    return;
  }

  try {
    const response = await apiGet<{ parkingSpaces: ParkingSpace[] }>(
      `/buildings/${buildingId}/parking-spaces`,
      accessToken,
    );
    setParkingSpaces(response.parkingSpaces);
  } catch (error) {
    setStatus(getErrorMessage(error));
  }
}

async function loadResidents(
  buildingId: string,
  setResidents: (residents: Resident[]) => void,
  setStatus: (status: string) => void,
) {
  const accessToken = localStorage.getItem(accessTokenKey);
  if (!accessToken) {
    return;
  }

  try {
    const response = await apiGet<{ residents: Resident[] }>(
      `/buildings/${buildingId}/residents`,
      accessToken,
    );
    setResidents(response.residents);
  } catch (error) {
    setStatus(getErrorMessage(error));
  }
}

async function apiGet<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  return parseApiResponse<T>(response);
}

async function apiPost<T = { ok: true }>(
  path: string,
  payload: unknown,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  return parseApiResponse<T>(response);
}

async function apiPostWithAuth<T = { ok: true }>(
  path: string,
  payload: unknown,
): Promise<T> {
  const accessToken = localStorage.getItem(accessTokenKey);
  if (!accessToken) {
    throw new Error("UNAUTHENTICATED");
  }

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
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "REQUEST_FAILED");
  }

  return data;
}

function parseResidentCsv(csv: string, unitByLabel: Map<string, string>) {
  const rows = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitCsvLine);
  const [header, ...dataRows] = rows;
  if (!header) {
    return [];
  }

  const indexes = new Map(
    header.map((name, index) => [normalizeHeader(name), index]),
  );

  return dataRows
    .map((row) => {
      const unitLabel = getCsvValue(row, indexes, "unidad");
      return {
        unitId: unitLabel
          ? unitByLabel.get(unitLabel.toLowerCase())
          : undefined,
        firstName: getCsvValue(row, indexes, "nombre"),
        lastName: getCsvValue(row, indexes, "apellido"),
        documentNumber: getCsvValue(row, indexes, "documento") || undefined,
        email: getCsvValue(row, indexes, "email") || undefined,
        phone: getCsvValue(row, indexes, "telefono") || undefined,
      };
    })
    .filter((resident) => resident.firstName && resident.lastName);
}

function getCsvValue(row: string[], indexes: Map<string, number>, key: string) {
  const index = indexes.get(key);
  return index === undefined ? "" : (row[index] ?? "").trim();
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current);
  return values;
}

function persistTokens(tokens: Tokens) {
  localStorage.setItem(accessTokenKey, tokens.accessToken);
  localStorage.setItem(refreshTokenKey, tokens.refreshToken);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "REQUEST_FAILED";
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
