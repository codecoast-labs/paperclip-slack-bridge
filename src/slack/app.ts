import { App } from "@slack/bolt";
import type { Config } from "../config.js";
import type { PaperclipClient } from "../paperclip/client.js";
import type { Store } from "../store.js";
import { registerCommands } from "./commands.js";
import { registerActions } from "./actions.js";
import { registerThreadHandler } from "./threads.js";

export function createSlackApp(
  config: Config,
  client: PaperclipClient,
  store: Store
): App {
  const app = new App({
    token: config.slack.botToken,
    appToken: config.slack.appToken,
    socketMode: true,
  });

  registerCommands(app, client);
  registerActions(app, client);
  registerThreadHandler(app, client, store);

  return app;
}
