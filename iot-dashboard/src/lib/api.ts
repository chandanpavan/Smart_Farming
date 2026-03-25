// Centralized API client and shared types for the dashboard

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";
export const MQTT_SERVICE_BASE_URL =
  process.env.NEXT_PUBLIC_MQTT_SERVICE_BASE_URL || "";
export const MQTT_COMMAND_TOPIC =
  process.env.NEXT_PUBLIC_MQTT_COMMAND_TOPIC || "farm/relay/command";

// ---------------- TYPES ----------------

export type ApiEnvelope<T> = {
  data: T;
  message: string;
};

export type PaginatedMeta = {
  total: number;
  limit: number;
  offset: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type PaginatedResult<T> = {
  success: boolean;
  message: string;
  data: T[];
  meta: PaginatedMeta;
};

export type SensorDataBE = {
  id: string;
  temperature: number;
  humidity: number;
  soilMoisture: number;
  soilTemperature: number | null;
  rainDetected: boolean;
  waterLevel: string;
  createdAt: string;
};

export type RelayLogBE = {
  id: string;
  relayStatus: boolean;
  triggerReason: string;
  sensorReadingId: string;
  createdAt: string;
  sensorData?: SensorDataBE;
};

export type HealthResponse = {
  success: boolean;
  message?: string;
  timestamp?: string;
  services?: { database: string; api: string };
};

export type MqttHealthResponse = {
  success: boolean;
  mqtt: { connected: boolean };
  timestamp: string;
};

// ---------------- CORE HTTP ----------------

async function http<T>(
  path: string,
  init?: RequestInit,
  isMqtt: boolean = false,
): Promise<T> {
  const BASE_URL = isMqtt ? MQTT_SERVICE_BASE_URL : API_BASE_URL;

  // ✅ FIX: always ensure /api prefix
  // const finalPath = path.startsWith("/api") ? path : `/api${path}`;

  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;

  console.log("BASE:", BASE_URL);
  console.log("PATH:", path);
  console.log("FINAL URL:", url);

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }

  return (await res.json()) as T;
}

// ---------------- SENSOR DATA ----------------

export async function fetchSensorDataPage(limit = 10, offset = 0) {
  const search = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  const json = await http<ApiEnvelope<PaginatedResult<SensorDataBE>>>(
    "/sensor-data?" + search.toString(),
  );

  return json.data;
}

export async function fetchLatestSensorData() {
  const json = await http<ApiEnvelope<SensorDataBE | null>>(
    "/sensor-data/latest",
  );
  return json.data;
}

// ---------------- RELAY LOG ----------------

export async function fetchRelayLogs(limit = 10, offset = 0) {
  const search = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  const json = await http<ApiEnvelope<PaginatedResult<RelayLogBE>>>(
    "/relay-log?" + search.toString(),
  );

  return json.data;
}

export async function fetchLatestRelayLog() {
  const json = await http<ApiEnvelope<RelayLogBE | null>>("/relay-log/latest");
  return json.data;
}

// ---------------- HEALTH ----------------

export async function fetchApiHealth() {
  return http<HealthResponse>("/health");
}

export async function fetchDbHealth() {
  return http<HealthResponse>("/db-test");
}

// ✅ FIXED HERE
export async function fetchMqttHealth() {
  return http<MqttHealthResponse>("/mqtt/health", undefined, true);
}

// ---------------- MQTT ----------------

export async function publishRelayCommand(payload: {
  relayStatus: boolean;
  sensorReadingId?: string;
  qos?: 0 | 1 | 2;
  retain?: boolean;
  topic?: string;
}) {
  const body = {
    topic: payload.topic || MQTT_COMMAND_TOPIC,
    payload: {
      relayStatus: payload.relayStatus,
      ...(payload.sensorReadingId
        ? { sensorReadingId: payload.sensorReadingId }
        : {}),
    },
    qos: payload.qos ?? 1,
    retain: payload.retain ?? false,
  };

  // ✅ FIXED HERE
  return http("/mqtt/publish", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
