import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  activateAccount,
  createVehicle,
  getCurrentUser,
  getResidentProfile,
  listBuildings,
  listVehicles,
  login,
  requestPasswordReset,
  type ApiError,
} from "./src/api";
import type { Building, Resident, Tokens, User, Vehicle } from "./src/types";

type AuthMode = "login" | "activation" | "reset";
type HomeTab = "access" | "profile" | "building" | "vehicles";

const accessTokenKey = "gzaccess.accessToken";
const refreshTokenKey = "gzaccess.refreshToken";

export default function App() {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [homeTab, setHomeTab] = useState<HomeTab>("access");
  const [user, setUser] = useState<User>();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    void restoreSession();
  }, []);

  const primaryRole = useMemo(() => user?.roles[0] ?? "RESIDENT", [user]);

  async function restoreSession() {
    setBusy(true);
    try {
      const token = await SecureStore.getItemAsync(accessTokenKey);
      if (!token) {
        return;
      }

      const response = await getCurrentUser(token);
      setUser(response.user);
      await loadBuildingData(token, response.user);
    } catch {
      await clearStoredSession();
    } finally {
      setBusy(false);
    }
  }

  async function persistSession(tokens: Tokens, nextUser: User) {
    await SecureStore.setItemAsync(accessTokenKey, tokens.accessToken);
    await SecureStore.setItemAsync(refreshTokenKey, tokens.refreshToken);
    setUser(nextUser);
    await loadBuildingData(tokens.accessToken, nextUser);
  }

  async function loadBuildingData(accessToken: string, nextUser: User) {
    const organizationId = nextUser.organizationIds[0];
    if (!organizationId) {
      setBuildings([]);
      return;
    }

    const [buildingResponse, residentResponse] = await Promise.all([
      listBuildings(accessToken, organizationId),
      getResidentProfile(accessToken),
    ]);
    setBuildings(buildingResponse.buildings);
    setResidents(residentResponse.residents);
    const buildingId =
      residentResponse.residents[0]?.buildingId ??
      buildingResponse.buildings[0]?.id ??
      "";
    setSelectedBuildingId(buildingId);
    if (!buildingId) {
      setVehicles([]);
      return;
    }

    const vehicleResponse = await listVehicles(accessToken, buildingId);
    setVehicles(vehicleResponse.vehicles);
  }

  async function submitLogin(email: string, password: string, mfaCode: string) {
    await runAction(async () => {
      const response = await login({ email, password, mfaCode });
      await persistSession(response.tokens, response.user);
      setStatus("Sesion iniciada");
    });
  }

  async function submitActivation(token: string, password: string) {
    await runAction(async () => {
      const response = await activateAccount({ token, password });
      await persistSession(response.tokens, response.user);
      setStatus("Cuenta activada");
    });
  }

  async function submitReset(email: string) {
    await runAction(async () => {
      const response = await requestPasswordReset(email);
      setStatus(response.resetToken ?? "Solicitud registrada");
    });
  }

  async function submitVehicle(input: {
    plate: string;
    brand: string;
    model: string;
    color: string;
  }) {
    await runAction(async () => {
      const accessToken = await requireStoredAccessToken();
      const resident = findCurrentResident(residents, selectedBuildingId);
      if (!selectedBuildingId || !resident) {
        throw new Error("RESIDENT_NOT_FOUND");
      }

      const response = await createVehicle(accessToken, {
        buildingId: selectedBuildingId,
        personId: resident.personId,
        plate: input.plate,
        country: "AR",
        brand: input.brand || undefined,
        model: input.model || undefined,
        color: input.color || undefined,
        type: "AUTO",
      });
      setVehicles((current) =>
        [...current, response.vehicle].sort((left, right) =>
          left.plateNormalized.localeCompare(right.plateNormalized),
        ),
      );
      setStatus("Vehiculo cargado");
    });
  }

  async function logout() {
    await clearStoredSession();
    setUser(undefined);
    setBuildings([]);
    setResidents([]);
    setVehicles([]);
    setSelectedBuildingId("");
    setStatus("");
  }

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setStatus("");
    try {
      await action();
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (busy && !user) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color="#f4c542" size="large" />
        <Text style={styles.loadingText}>GzAccess</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      {user ? (
        <AuthenticatedApp
          buildings={buildings}
          busy={busy}
          homeTab={homeTab}
          primaryRole={primaryRole}
          residents={residents}
          selectedBuildingId={selectedBuildingId}
          setHomeTab={setHomeTab}
          status={status}
          user={user}
          vehicles={vehicles}
          onLogout={logout}
          onVehicleSubmit={submitVehicle}
        />
      ) : (
        <AuthApp
          authMode={authMode}
          busy={busy}
          setAuthMode={setAuthMode}
          status={status}
          onActivation={submitActivation}
          onLogin={submitLogin}
          onReset={submitReset}
        />
      )}
    </SafeAreaView>
  );
}

function AuthApp({
  authMode,
  busy,
  onActivation,
  onLogin,
  onReset,
  setAuthMode,
  status,
}: {
  authMode: AuthMode;
  busy: boolean;
  onActivation: (token: string, password: string) => Promise<void>;
  onLogin: (email: string, password: string, mfaCode: string) => Promise<void>;
  onReset: (email: string) => Promise<void>;
  setAuthMode: (mode: AuthMode) => void;
  status: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [token, setToken] = useState("");

  return (
    <ScrollView contentContainerStyle={styles.authContent}>
      <View style={styles.brandBlock}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>GA</Text>
        </View>
        <Text style={styles.brandName}>GzAccess</Text>
        <Text style={styles.brandSubtitle}>Acceso residencial seguro</Text>
      </View>

      <View style={styles.segmented}>
        <SegmentButton
          active={authMode === "login"}
          label="Login"
          onPress={() => setAuthMode("login")}
        />
        <SegmentButton
          active={authMode === "activation"}
          label="Activar"
          onPress={() => setAuthMode("activation")}
        />
        <SegmentButton
          active={authMode === "reset"}
          label="Reset"
          onPress={() => setAuthMode("reset")}
        />
      </View>

      {authMode === "login" ? (
        <View style={styles.form}>
          <FormInput
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            value={email}
            onChangeText={setEmail}
          />
          <FormInput
            label="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <FormInput
            keyboardType="number-pad"
            label="MFA"
            value={mfaCode}
            onChangeText={setMfaCode}
          />
          <PrimaryButton
            busy={busy}
            label="Entrar"
            onPress={() => onLogin(email, password, mfaCode)}
          />
        </View>
      ) : null}

      {authMode === "activation" ? (
        <View style={styles.form}>
          <FormInput
            autoCapitalize="none"
            label="Token"
            value={token}
            onChangeText={setToken}
          />
          <FormInput
            label="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <PrimaryButton
            busy={busy}
            label="Activar cuenta"
            onPress={() => onActivation(token, password)}
          />
        </View>
      ) : null}

      {authMode === "reset" ? (
        <View style={styles.form}>
          <FormInput
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            value={email}
            onChangeText={setEmail}
          />
          <PrimaryButton
            busy={busy}
            label="Solicitar reset"
            onPress={() => onReset(email)}
          />
        </View>
      ) : null}

      {status ? <Text style={styles.status}>{status}</Text> : null}
    </ScrollView>
  );
}

function AuthenticatedApp({
  buildings,
  busy,
  homeTab,
  onLogout,
  onVehicleSubmit,
  primaryRole,
  residents,
  selectedBuildingId,
  setHomeTab,
  status,
  user,
  vehicles,
}: {
  buildings: Building[];
  busy: boolean;
  homeTab: HomeTab;
  onLogout: () => Promise<void>;
  onVehicleSubmit: (input: {
    plate: string;
    brand: string;
    model: string;
    color: string;
  }) => Promise<void>;
  primaryRole: string;
  residents: Resident[];
  selectedBuildingId: string;
  setHomeTab: (tab: HomeTab) => void;
  status: string;
  user: User;
  vehicles: Vehicle[];
}) {
  const currentResident = findCurrentResident(residents, selectedBuildingId);

  return (
    <View style={styles.appContent}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Sesion activa</Text>
          <Text style={styles.title}>{user.displayName}</Text>
          <Text style={styles.subtitle}>{primaryRole}</Text>
        </View>
        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Salir</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        <TabButton
          active={homeTab === "access"}
          label="Acceso"
          onPress={() => setHomeTab("access")}
        />
        <TabButton
          active={homeTab === "profile"}
          label="Perfil"
          onPress={() => setHomeTab("profile")}
        />
        <TabButton
          active={homeTab === "building"}
          label="Edificio"
          onPress={() => setHomeTab("building")}
        />
        <TabButton
          active={homeTab === "vehicles"}
          label="Vehiculos"
          onPress={() => setHomeTab("vehicles")}
        />
      </View>

      <ScrollView contentContainerStyle={styles.homeBody}>
        {homeTab === "access" ? (
          <AccessPanel busy={busy} status={status} />
        ) : null}
        {homeTab === "profile" ? <ProfilePanel user={user} /> : null}
        {homeTab === "building" ? (
          <BuildingPanel buildings={buildings} user={user} />
        ) : null}
        {homeTab === "vehicles" ? (
          <VehiclePanel
            busy={busy}
            currentResident={currentResident}
            vehicles={vehicles}
            onSubmit={onVehicleSubmit}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function AccessPanel({ busy, status }: { busy: boolean; status: string }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Mi acceso</Text>
      <View style={styles.qrPlaceholder}>
        <Text style={styles.qrText}>QR</Text>
      </View>
      <Text style={styles.panelBody}>
        Credencial movil pendiente de habilitar cuando este listo el modulo de
        permisos y sincronizacion.
      </Text>
      {busy ? <ActivityIndicator color="#2f6f5e" /> : null}
      {status ? <Text style={styles.statusInline}>{status}</Text> : null}
    </View>
  );
}

function ProfilePanel({ user }: { user: User }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Perfil</Text>
      <InfoRow label="Email" value={user.email} />
      <InfoRow label="Roles" value={user.roles.join(", ")} />
      <InfoRow
        label="Organizaciones"
        value={String(user.organizationIds.length)}
      />
      <View style={styles.moduleGrid}>
        <ModuleTile label="Rostro" state="Fase 3" />
        <ModuleTile label="Vehiculos" state="API base" />
        <ModuleTile label="Notificaciones" state="Push pendiente" />
      </View>
    </View>
  );
}

function BuildingPanel({
  buildings,
  user,
}: {
  buildings: Building[];
  user: User;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Edificios</Text>
      {buildings.length === 0 ? (
        <Text style={styles.panelBody}>
          Sin edificios cargados para tu organizacion.
        </Text>
      ) : (
        buildings.map((building) => (
          <View key={building.id} style={styles.buildingRow}>
            <Text style={styles.buildingName}>{building.name}</Text>
            <Text style={styles.buildingAddress}>{building.address}</Text>
          </View>
        ))
      )}
      <Text style={styles.caption}>{user.organizationIds.join(", ")}</Text>
    </View>
  );
}

function VehiclePanel({
  busy,
  currentResident,
  onSubmit,
  vehicles,
}: {
  busy: boolean;
  currentResident?: Resident;
  vehicles: Vehicle[];
  onSubmit: (input: {
    plate: string;
    brand: string;
    model: string;
    color: string;
  }) => Promise<void>;
}) {
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");

  async function submit() {
    await onSubmit({ plate, brand, model, color });
    setPlate("");
    setBrand("");
    setModel("");
    setColor("");
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Vehiculos</Text>
      {currentResident ? (
        <Text style={styles.panelBody}>
          {currentResident.firstName} {currentResident.lastName}
          {currentResident.unitLabel ? ` - ${currentResident.unitLabel}` : ""}
        </Text>
      ) : (
        <Text style={styles.panelBody}>
          No encontramos un perfil residencial asociado a esta sesion.
        </Text>
      )}

      <View style={styles.form}>
        <FormInput
          autoCapitalize="characters"
          label="Patente"
          value={plate}
          onChangeText={setPlate}
        />
        <FormInput label="Marca" value={brand} onChangeText={setBrand} />
        <FormInput label="Modelo" value={model} onChangeText={setModel} />
        <FormInput label="Color" value={color} onChangeText={setColor} />
        <PrimaryButton
          busy={busy || !currentResident}
          label="Cargar vehiculo"
          onPress={submit}
        />
      </View>

      <View style={styles.vehicleList}>
        {vehicles.length === 0 ? (
          <Text style={styles.caption}>Sin vehiculos cargados</Text>
        ) : (
          vehicles.map((vehicle) => (
            <View key={vehicle.id} style={styles.vehicleRow}>
              <Text style={styles.vehiclePlate}>{vehicle.plateNormalized}</Text>
              <Text style={styles.vehicleDetail}>
                {[vehicle.brand, vehicle.model, vehicle.color]
                  .filter(Boolean)
                  .join(" ") || vehicle.state}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function FormInput({
  label,
  ...props
}: {
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "number-pad";
  label: string;
  secureTextEntry?: boolean;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#8b938f"
        style={styles.input}
        {...props}
      />
    </View>
  );
}

function PrimaryButton({
  busy,
  label,
  onPress,
}: {
  busy: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable disabled={busy} style={styles.primaryButton} onPress={onPress}>
      <Text style={styles.primaryButtonText}>
        {busy ? "Procesando" : label}
      </Text>
    </Pressable>
  );
}

function SegmentButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.segmentButton, active ? styles.segmentButtonActive : null]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.segmentButtonText,
          active ? styles.segmentButtonTextActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TabButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.tabButton, active ? styles.tabButtonActive : null]}
      onPress={onPress}
    >
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ModuleTile({ label, state }: { label: string; state: string }) {
  return (
    <View style={styles.moduleTile}>
      <Text style={styles.moduleLabel}>{label}</Text>
      <Text style={styles.moduleState}>{state}</Text>
    </View>
  );
}

async function clearStoredSession() {
  await SecureStore.deleteItemAsync(accessTokenKey);
  await SecureStore.deleteItemAsync(refreshTokenKey);
}

async function requireStoredAccessToken(): Promise<string> {
  const token = await SecureStore.getItemAsync(accessTokenKey);
  if (!token) {
    throw new Error("UNAUTHENTICATED");
  }

  return token;
}

function findCurrentResident(
  residents: Resident[],
  buildingId: string,
): Resident | undefined {
  return (
    residents.find((resident) => resident.buildingId === buildingId) ??
    residents[0]
  );
}

function getErrorMessage(error: unknown): string {
  const apiError = error as ApiError;
  return apiError.code ?? (error instanceof Error ? error.message : "ERROR");
}

const styles = StyleSheet.create({
  appContent: {
    backgroundColor: "#eef1ee",
    flex: 1,
  },
  authContent: {
    backgroundColor: "#eef1ee",
    flexGrow: 1,
    gap: 18,
    justifyContent: "center",
    padding: 22,
  },
  brandBlock: {
    gap: 8,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: "#f4c542",
    borderRadius: 8,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  brandMarkText: {
    color: "#18211f",
    fontSize: 16,
    fontWeight: "800",
  },
  brandName: {
    color: "#18211f",
    fontSize: 34,
    fontWeight: "800",
  },
  brandSubtitle: {
    color: "#4b5563",
    fontSize: 16,
  },
  buildingAddress: {
    color: "#4b5563",
    fontSize: 14,
  },
  buildingName: {
    color: "#18211f",
    fontSize: 16,
    fontWeight: "700",
  },
  buildingRow: {
    borderBottomColor: "#e5ebe7",
    borderBottomWidth: 1,
    gap: 4,
    paddingVertical: 12,
  },
  caption: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 12,
  },
  field: {
    gap: 6,
  },
  form: {
    gap: 14,
  },
  header: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomColor: "#d9dfdb",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
  },
  homeBody: {
    padding: 16,
  },
  infoLabel: {
    color: "#6b7280",
    fontSize: 13,
  },
  infoRow: {
    borderBottomColor: "#e5ebe7",
    borderBottomWidth: 1,
    gap: 4,
    paddingVertical: 12,
  },
  infoValue: {
    color: "#18211f",
    fontSize: 16,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#c7d0ca",
    borderRadius: 8,
    borderWidth: 1,
    color: "#18211f",
    minHeight: 48,
    paddingHorizontal: 12,
  },
  kicker: {
    color: "#2f6f5e",
    fontSize: 13,
    fontWeight: "700",
  },
  label: {
    color: "#4b5563",
    fontSize: 13,
    fontWeight: "700",
  },
  loadingScreen: {
    alignItems: "center",
    backgroundColor: "#18211f",
    flex: 1,
    gap: 14,
    justifyContent: "center",
  },
  loadingText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
  logoutButton: {
    backgroundColor: "#eef1ee",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  logoutText: {
    color: "#18211f",
    fontWeight: "700",
  },
  moduleGrid: {
    gap: 10,
    marginTop: 16,
  },
  moduleLabel: {
    color: "#18211f",
    fontSize: 15,
    fontWeight: "700",
  },
  moduleState: {
    color: "#6b7280",
    fontSize: 13,
  },
  moduleTile: {
    backgroundColor: "#eef1ee",
    borderRadius: 8,
    gap: 4,
    padding: 12,
  },
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#d9dfdb",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  panelBody: {
    color: "#4b5563",
    fontSize: 15,
    lineHeight: 22,
  },
  panelTitle: {
    color: "#18211f",
    fontSize: 22,
    fontWeight: "800",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#18211f",
    borderRadius: 8,
    minHeight: 48,
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  qrPlaceholder: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#eef1ee",
    borderColor: "#18211f",
    borderRadius: 8,
    borderWidth: 2,
    height: 168,
    justifyContent: "center",
    marginVertical: 18,
    width: 168,
  },
  qrText: {
    color: "#18211f",
    fontSize: 42,
    fontWeight: "900",
  },
  screen: {
    backgroundColor: "#eef1ee",
    flex: 1,
  },
  segmented: {
    backgroundColor: "#d9dfdb",
    borderRadius: 8,
    flexDirection: "row",
    gap: 4,
    padding: 4,
  },
  segmentButton: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    minHeight: 42,
    justifyContent: "center",
  },
  segmentButtonActive: {
    backgroundColor: "#2f6f5e",
  },
  segmentButtonText: {
    color: "#18211f",
    fontWeight: "700",
  },
  segmentButtonTextActive: {
    color: "#ffffff",
  },
  status: {
    backgroundColor: "#ffffff",
    borderColor: "#d9dfdb",
    borderRadius: 8,
    borderWidth: 1,
    color: "#18211f",
    padding: 12,
  },
  statusInline: {
    color: "#2f6f5e",
    fontWeight: "700",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 14,
  },
  tabButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    minHeight: 42,
    justifyContent: "center",
  },
  tabButtonActive: {
    backgroundColor: "#2f6f5e",
  },
  tabs: {
    backgroundColor: "#ffffff",
    borderBottomColor: "#d9dfdb",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 8,
    padding: 12,
  },
  tabText: {
    color: "#18211f",
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#ffffff",
  },
  title: {
    color: "#18211f",
    fontSize: 22,
    fontWeight: "800",
  },
  vehicleDetail: {
    color: "#4b5563",
    fontSize: 14,
  },
  vehicleList: {
    gap: 10,
    marginTop: 16,
  },
  vehiclePlate: {
    color: "#18211f",
    fontSize: 18,
    fontWeight: "800",
  },
  vehicleRow: {
    backgroundColor: "#eef1ee",
    borderRadius: 8,
    gap: 4,
    padding: 12,
  },
});
