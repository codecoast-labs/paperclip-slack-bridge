import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  let tmpDir: string;
  const originalEnv = { ...process.env };

  function setRequiredEnv() {
    process.env.PAPERCLIP_API_URL = "http://server:3100/api";
    process.env.PAPERCLIP_API_KEY = "test-key";
    process.env.PAPERCLIP_COMPANY_ID = "co-1";
    process.env.SLACK_BOT_TOKEN = "xoxb-test";
    process.env.SLACK_APP_TOKEN = "xapp-test";
  }

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "config-test-"));
    setRequiredEnv();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads all required env vars", () => {
    process.env.CHANNEL_MAP_PATH = join(tmpDir, "channels.json");
    writeFileSync(
      process.env.CHANNEL_MAP_PATH,
      JSON.stringify({ default: "#test", routes: [] })
    );

    const config = loadConfig();
    assert.equal(config.paperclip.apiUrl, "http://server:3100/api");
    assert.equal(config.paperclip.apiKey, "test-key");
    assert.equal(config.paperclip.companyId, "co-1");
    assert.equal(config.slack.botToken, "xoxb-test");
    assert.equal(config.slack.appToken, "xapp-test");
  });

  it("throws when required env var is missing", () => {
    delete process.env.PAPERCLIP_API_KEY;
    assert.throws(() => loadConfig(), /PAPERCLIP_API_KEY/);
  });

  it("uses default poll interval when not set", () => {
    delete process.env.POLL_INTERVAL_MS;
    process.env.CHANNEL_MAP_PATH = join(tmpDir, "channels.json");
    writeFileSync(
      process.env.CHANNEL_MAP_PATH,
      JSON.stringify({ default: "#test", routes: [] })
    );

    const config = loadConfig();
    assert.equal(config.pollIntervalMs, 30000);
  });

  it("parses custom poll interval", () => {
    process.env.POLL_INTERVAL_MS = "5000";
    process.env.CHANNEL_MAP_PATH = join(tmpDir, "channels.json");
    writeFileSync(
      process.env.CHANNEL_MAP_PATH,
      JSON.stringify({ default: "#test", routes: [] })
    );

    const config = loadConfig();
    assert.equal(config.pollIntervalMs, 5000);
  });

  it("falls back to default channel map when file missing", () => {
    process.env.CHANNEL_MAP_PATH = join(tmpDir, "nonexistent.json");
    const config = loadConfig();
    assert.equal(config.channelMap.default, "#agent-updates");
    assert.deepEqual(config.channelMap.routes, []);
  });

  it("loads channel map from file", () => {
    const mapPath = join(tmpDir, "channels.json");
    writeFileSync(
      mapPath,
      JSON.stringify({
        default: "#custom",
        routes: [{ match: { action: "test" }, channel: "#test-chan" }],
      })
    );
    process.env.CHANNEL_MAP_PATH = mapPath;

    const config = loadConfig();
    assert.equal(config.channelMap.default, "#custom");
    assert.equal(config.channelMap.routes.length, 1);
    assert.equal(config.channelMap.routes[0].channel, "#test-chan");
  });
});
