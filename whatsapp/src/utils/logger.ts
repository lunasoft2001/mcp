import { config } from "../config/env.js";

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof LEVELS;

function shouldLog(level: Level): boolean {
  return LEVELS[level] >= LEVELS[config.logLevel];
}

function format(level: Level, message: string, context?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const ctx = context ? ` ${JSON.stringify(context)}` : "";
  return `[${ts}] [${level.toUpperCase()}] ${message}${ctx}`;
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    if (shouldLog("debug")) process.stderr.write(format("debug", message, context) + "\n");
  },
  info(message: string, context?: Record<string, unknown>): void {
    if (shouldLog("info")) process.stderr.write(format("info", message, context) + "\n");
  },
  warn(message: string, context?: Record<string, unknown>): void {
    if (shouldLog("warn")) process.stderr.write(format("warn", message, context) + "\n");
  },
  error(message: string, context?: Record<string, unknown>): void {
    if (shouldLog("error")) process.stderr.write(format("error", message, context) + "\n");
  },
};
