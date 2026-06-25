export const environmentalTypes = ["TEMPERATURE", "HUMIDITY", "PRESSURE"] as const;

export type EnvironmentalType = (typeof environmentalTypes)[number];
export type EnvironmentalStatus = "OK" | "ALERT" | "ACTION";

export const environmentalSensorMap = {
  temperature: {
    T1: "VEST",
    Temperature1: "VEST",
    Temp1: "VEST",
    T2: "AC1",
    Temperature2: "AC1",
    Temp2: "AC1",
    T3: "AC2",
    Temperature3: "AC2",
    Temp3: "AC2",
    T4: "AC3",
    Temperature4: "AC3",
    Temp4: "AC3",
    T5: "SASC",
    Temperature5: "SASC",
    Temp5: "SASC",
    T6: "SP1",
    Temperature6: "SP1",
    Temp6: "SP1",
    T7: "SP2",
    Temperature7: "SP2",
    Temp7: "SP2",
  },
  humidity: {
    H1: "VEST",
    Humidity1: "VEST",
    Humidade1: "VEST",
    Hum1: "VEST",
    H2: "AC1",
    Humidity2: "AC1",
    Humidade2: "AC1",
    Hum2: "AC1",
    H3: "AC2",
    Humidity3: "AC2",
    Humidade3: "AC2",
    Hum3: "AC2",
    H4: "AC3",
    Humidity4: "AC3",
    Humidade4: "AC3",
    Hum4: "AC3",
    H5: "SASC",
    Humidity5: "SASC",
    Humidade5: "SASC",
    Hum5: "SASC",
    H6: "SP1",
    Humidity6: "SP1",
    Humidade6: "SP1",
    Hum6: "SP1",
    H7: "SP2",
    Humidity7: "SP2",
    Humidade7: "SP2",
    Hum7: "SP2",
  },
  pressure: {
    PA: "SP1-VEST",
    PressureA: "SP1-VEST",
    PressaoA: "SP1-VEST",
    PB: "VEST-SP2",
    PressureB: "VEST-SP2",
    PressaoB: "VEST-SP2",
    PC: "SP2-SASC",
    PressureC: "SP2-SASC",
    PressaoC: "SP2-SASC",
    PD: "ARM-AC1",
    PressureD: "ARM-AC1",
    PressaoD: "ARM-AC1",
    PE: "AC1-SP1",
    PressureE: "AC1-SP1",
    PressaoE: "AC1-SP1",
    PF: "SP1-AC2",
    PressureF: "SP1-AC2",
    PressaoF: "SP1-AC2",
    PG: "SASC-AC3",
    PressureG: "SASC-AC3",
    PressaoG: "SASC-AC3",
    PH: "AC3-SP2",
    PressureH: "AC3-SP2",
    PressaoH: "AC3-SP2",
    PI: "SP2-UEM1",
    PressureI: "SP2-UEM1",
    PressaoI: "SP2-UEM1",
  },
} as const;

export const temperatureZones = ["VEST", "SP1", "SASC", "SP2", "AC1", "AC2", "AC3"] as const;
export const humidityZones = temperatureZones;
export const pressureZones = [
  "SP1-VEST",
  "VEST-SP2",
  "SP2-SASC",
  "ARM-AC1",
  "AC1-SP1",
  "SP1-AC2",
  "SASC-AC3",
  "AC3-SP2",
  "SP2-UEM1",
] as const;

export const environmentalEventZones = [
  "AC1",
  "AC1-SP1",
  "AC2",
  "AC3",
  "AC3-SP2",
  "ARM-AC1",
  "SASC",
  "SASC-AC3",
  "SP1",
  "SP1-AC2",
  "SP1-VEST",
  "SP2",
  "SP2-SASC",
  "SP2-UEM1",
  "VEST",
  "VEST-SP2",
] as const;

function normalizeHeader(header: string) {
  return header
    .trim()
    .replace(/\s+/g, "")
    .replace(/[_-]/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildLookup(source: Record<string, string>) {
  return Object.fromEntries(Object.entries(source).map(([key, value]) => [normalizeHeader(key), value]));
}

const temperatureLookup = buildLookup(environmentalSensorMap.temperature);
const humidityLookup = buildLookup(environmentalSensorMap.humidity);
const pressureLookup = buildLookup(environmentalSensorMap.pressure);

export function environmentalType(header: string): EnvironmentalType | null {
  const normalized = normalizeHeader(header);
  if (temperatureLookup[normalized]) return "TEMPERATURE";
  if (humidityLookup[normalized]) return "HUMIDITY";
  if (pressureLookup[normalized]) return "PRESSURE";
  return null;
}

export function environmentalZone(header: string, type = environmentalType(header)) {
  const normalized = normalizeHeader(header);
  if (type === "TEMPERATURE") return temperatureLookup[normalized] ?? null;
  if (type === "HUMIDITY") return humidityLookup[normalized] ?? null;
  if (type === "PRESSURE") return pressureLookup[normalized] ?? null;
  return null;
}

export function environmentalTypeLabel(type: string) {
  if (type === "TEMPERATURE") return "Temperatura";
  if (type === "HUMIDITY") return "Humidade";
  return "Pressao";
}

export function environmentalLimits(type: string) {
  if (type === "TEMPERATURE") return { min: 15, max: 25, actionSeconds: 86_400 };
  if (type === "HUMIDITY") return { min: 30, max: 70, actionSeconds: 86_400 };
  return { min: 5, max: Number.POSITIVE_INFINITY, actionSeconds: 2_400 };
}

export function simpleEnvironmentalStatus(type: string, value: number): EnvironmentalStatus {
  const limits = environmentalLimits(type);
  if (value < limits.min || value > limits.max) return "ALERT";
  return "OK";
}
