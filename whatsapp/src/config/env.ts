import "dotenv/config";

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  defaultCountryCode: process.env["DEFAULT_COUNTRY_CODE"] ?? "43",
  logLevel: (process.env["LOG_LEVEL"] ?? "info") as "debug" | "info" | "warn" | "error",
  wa: {
    sessionPath: process.env["WA_SESSION_PATH"] ?? "./.wwebjs_auth",
    sessionName: process.env["WA_SESSION_NAME"] ?? "mcp-session",
    readyTimeoutMs: parseInt(process.env["WA_READY_TIMEOUT_MS"] ?? "30000", 10),
  },
} as const;

// Silencia el error de requireEnv no usada directamente — se usa para otros .env opcionales
void requireEnv;
