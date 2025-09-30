import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, Platform } from "react-native";
import * as Location from "expo-location";
import * as Application from "expo-application";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
// Reutiliza tus módulos existentes si ya los tienes:
import { offlineDB, LocationPoint } from "./lib/offline-tracking";
import { syncService } from "./lib/sync-tracking";

export default function TrackingDashboard() {
  const [isTracking, setIsTracking] = useState(false);
  const [locationCount, setLocationCount] = useState(0);
  const [pendingSync, setPendingSync] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [deviceAlias, setDeviceAlias] = useState("");
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [deviceId, setDeviceId] = useState("");

  const locSubRef = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startAtRef = useRef<number | null>(null);

  useEffect(() => {
    // Cargar config guardada
    (async () => {
      const alias = (await AsyncStorage.getItem("lm_device_alias")) || "";
      const endpoint = (await AsyncStorage.getItem("api_endpoint")) || "";
      setDeviceAlias(alias);
      setApiEndpoint(endpoint);
      if (!alias || !endpoint) setShowSettings(true);

      // ID de dispositivo
      if (Platform.OS === "android") {
        setDeviceId(Application.androidId ?? "UNKNOWN-ANDROID");
      } else {
        const id = await Application.getIosIdForVendorAsync();
        setDeviceId(id ?? "UNKNOWN-IOS");
      }

      await reloadPending();
    })();

    // Online/offline
    const unsub = NetInfo.addEventListener((state) => setIsOnline(Boolean(state.isConnected)));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isOnline && apiEndpoint) {
      syncService.startAutoSync(apiEndpoint, 30000);
    }
    return () => syncService.stopAutoSync();
  }, [isOnline, apiEndpoint]);

  const reloadPending = async () => {
    const count = await offlineDB.getLocationCount();
    setPendingSync(count);
  };

  const startTracking = async () => {
    if (!deviceAlias || !apiEndpoint) {
      setShowSettings(true);
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Necesitamos el permiso de ubicación para rastrear.");
      return;
    }

    startAtRef.current = Date.now();
    setElapsed(0);
    setLocationCount(0);
    setIsTracking(true);

    timerRef.current = setInterval(() => {
      if (startAtRef.current) setElapsed(Math.floor((Date.now() - startAtRef.current) / 1000));
    }, 1000);

    locSubRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
      async (pos) => {
        const point: LocationPoint = {
          lm_device_id: deviceId,
          lm_latitude: pos.coords.latitude.toFixed(8),
          lm_longitude: pos.coords.longitude.toFixed(8),
          lm_device_alias: deviceAlias,
          lm_datetime: new Date().toISOString().replace("T", " ").substring(0, 23),
        };
        await offlineDB.addLocation(point);
        setLocationCount((n) => n + 1);
        await reloadPending();
      }
    );
  };

  const stopTracking = () => {
    locSubRef.current?.remove();
    locSubRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    startAtRef.current = null;
    setIsTracking(false);
  };

  const manualSync = async () => {
    if (!apiEndpoint) {
      Alert.alert("Configura el endpoint primero");
      return;
    }
    const res = await syncService.syncLocations(apiEndpoint);
    if (res.success) {
      setLastSync(new Date());
      await reloadPending();
      Alert.alert("Sincronizado", `${res.synced} ubicaciones enviadas`);
    } else {
      Alert.alert("Error", String(res.error ?? "No se pudo sincronizar"));
    }
  };

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const z = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${z}`;
  };

  if (showSettings) {
    return (
      <View style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.title}>Configuración Inicial</Text>
          <Text style={styles.sub}>Configura tu dispositivo antes de comenzar</Text>

          <Text style={styles.label}>Nombre del Dispositivo</Text>
          <TextInput
            value={deviceAlias}
            onChangeText={setDeviceAlias}
            placeholder="Ej: samsung s9"
            style={styles.input}
          />

          <Text style={styles.label}>URL del API</Text>
          <TextInput
            value={apiEndpoint}
            onChangeText={setApiEndpoint}
            placeholder="https://tu-api.com/tracking"
            autoCapitalize="none"
            style={styles.input}
          />

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>ID del Dispositivo:</Text>
            <Text style={styles.mono}>{deviceId}</Text>
          </View>

          <Pressable
            style={styles.button}
            onPress={async () => {
              if (!deviceAlias || !apiEndpoint) {
                Alert.alert("Completa todos los campos");
                return;
              }
              await AsyncStorage.setItem("lm_device_alias", deviceAlias);
              await AsyncStorage.setItem("api_endpoint", apiEndpoint);
              setShowSettings(false);
            }}
          >
            <Text style={styles.buttonText}>Guardar Configuración</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Text style={styles.appTitle}>Rastreo GPS</Text>
        <View style={[styles.badge, { backgroundColor: isOnline ? "#dcfce7" : "#fee2e2", borderColor: isOnline ? "#86efac" : "#fecaca" }]}>
          <Text style={{ color: isOnline ? "#166534" : "#991b1b" }}>{isOnline ? "En línea" : "Sin conexión"}</Text>
        </View>
        <Pressable onPress={() => setShowSettings(true)} style={styles.settingsBtn}>
          <Text>⚙️</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Estado de Jornada</Text>
        <Text style={styles.sub}>{deviceAlias || "Sin configurar"}</Text>

        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <Text style={styles.timer}>{fmt(elapsed)}</Text>
          <Text style={styles.muted}>{isTracking ? "Jornada en curso" : "Jornada detenida"}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: "#eff6ff" }]}>
            <Text style={styles.muted}>Puntos registrados</Text>
            <Text style={[styles.statNum, { color: "#1d4ed8" }]}>{locationCount}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: "#fff7ed" }]}>
            <Text style={styles.muted}>Pendientes</Text>
            <Text style={[styles.statNum, { color: "#c2410c" }]}>{pendingSync}</Text>
          </View>
        </View>

        {!isTracking ? (
          <Pressable onPress={startTracking} style={[styles.button, { height: 56 }]}>
            <Text style={styles.buttonText}>▶ Iniciar Jornada Laboral</Text>
          </Pressable>
        ) : (
          <Pressable onPress={stopTracking} style={[styles.buttonDanger, { height: 56 }]}>
            <Text style={styles.buttonText}>■ Finalizar Jornada Laboral</Text>
          </Pressable>
        )}

        {pendingSync > 0 && (
          <Pressable onPress={manualSync} disabled={!isOnline} style={[styles.buttonOutline, !isOnline && { opacity: 0.5 }]}>
            <Text style={[styles.buttonOutlineText]}>⇧  Sincronizar Ahora ({pendingSync})</Text>
          </Pressable>
        )}

        {lastSync && <Text style={[styles.muted, { textAlign: "center", marginTop: 8 }]}>
          Última sincronización: {lastSync.toLocaleTimeString()}
        </Text>}
      </View>

      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.muted}>ID Dispositivo:</Text>
          <Text style={styles.mono}>{deviceId.slice(0, 15)}...</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.muted}>Sincronización:</Text>
          <Text>{isOnline ? "Automática cada 30s" : "Pausada (sin conexión)"}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#eef2ff", padding: 16 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, elevation: 1 },
  headerRow: { flexDirection: "row", alignItems: "center" },
  appTitle: { flex: 1, fontSize: 22, fontWeight: "bold", color: "#111827" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  settingsBtn: { marginLeft: 8, padding: 8 },
  title: { fontSize: 18, fontWeight: "600", color: "#111827" },
  sub: { color: "#6b7280", marginTop: 2 },
  timer: { fontSize: 40, fontWeight: "bold", color: "#111827", fontVariant: ["tabular-nums"] },
  muted: { color: "#6b7280" },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  statBox: { flex: 1, padding: 12, borderRadius: 10 },
  statNum: { fontSize: 24, fontWeight: "bold" },
  label: { fontWeight: "600", marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  infoBox: { backgroundColor: "#eff6ff", borderRadius: 8, padding: 10, marginTop: 8 },
  infoTitle: { fontWeight: "600", marginBottom: 4 },
  mono: { fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }), color: "#374151" },
  button: { backgroundColor: "#111827", alignItems: "center", justifyContent: "center", borderRadius: 10, paddingVertical: 12, marginTop: 12 },
  buttonDanger: { backgroundColor: "#dc2626", alignItems: "center", justifyContent: "center", borderRadius: 10, paddingVertical: 12, marginTop: 12 },
  buttonText: { color: "#fff", fontWeight: "600" },
  buttonOutline: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 10, backgroundColor: "transparent" },
  buttonOutlineText: { color: "#111827", fontWeight: "600" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 4 },
});
