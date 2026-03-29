import { loadConfig } from "./config.js";
import { Store } from "./store.js";
import { PaperclipClient } from "./paperclip/client.js";
import { ChannelRouter } from "./router.js";
import { Poller } from "./paperclip/poller.js";
import { createSlackApp } from "./slack/app.js";

async function main() {
  console.log("Paperclip Slack Bridge starting...");

  const config = loadConfig();
  const store = new Store(config.sqlitePath);
  const client = new PaperclipClient(config);
  const router = new ChannelRouter(config.channelMap);
  const app = createSlackApp(config, client, store);

  // Resolve channel names → IDs before starting
  await router.resolveChannelIds(app.client);

  // Start the Bolt app (Socket Mode connects to Slack)
  await app.start();
  console.log("Slack app connected via Socket Mode");

  // Start polling Paperclip activity
  const poller = new Poller(client, store, router, app, config.pollIntervalMs);
  poller.start();

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down...");
    poller.stop();
    await app.stop();
    store.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
