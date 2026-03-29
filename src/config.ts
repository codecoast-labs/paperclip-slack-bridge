import { readFileSync } from "node:fs";

export interface RouteRule {
  match: Record<string, string>;
  channel: string;
}

export interface ChannelMap {
  default: string;
  routes: RouteRule[];
}

export interface Config {
  paperclip: {
    apiUrl: string;
    apiKey: string;
    companyId: string;
  };
  slack: {
    botToken: string;
    appToken: string;
  };
  pollIntervalMs: number;
  channelMap: ChannelMap;
  sqlitePath: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function loadChannelMap(path: string): ChannelMap {
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as ChannelMap;
  } catch {
    console.warn(`Could not load channel map from ${path}, using defaults`);
    return { default: "#agent-updates", routes: [] };
  }
}

export function loadConfig(): Config {
  const channelMapPath =
    process.env.CHANNEL_MAP_PATH ?? "/config/channels.json";

  return {
    paperclip: {
      apiUrl: requireEnv("PAPERCLIP_API_URL"),
      apiKey: requireEnv("PAPERCLIP_API_KEY"),
      companyId: requireEnv("PAPERCLIP_COMPANY_ID"),
    },
    slack: {
      botToken: requireEnv("SLACK_BOT_TOKEN"),
      appToken: requireEnv("SLACK_APP_TOKEN"),
    },
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? "30000", 10),
    channelMap: loadChannelMap(channelMapPath),
    sqlitePath: process.env.SQLITE_PATH ?? "/data/bridge.db",
  };
}
