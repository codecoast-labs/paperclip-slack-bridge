import type { App } from "@slack/bolt";
import type { PaperclipClient } from "../paperclip/client.js";
import type { Store } from "../store.js";

export function registerThreadHandler(
  app: App,
  client: PaperclipClient,
  store: Store
): void {
  app.event("message", async ({ event, say }) => {
    // Only handle threaded replies (messages with thread_ts that aren't the parent)
    if (!("thread_ts" in event) || !event.thread_ts) return;
    if (event.thread_ts === event.ts) return; // This is the parent message
    if ("subtype" in event && event.subtype) return; // Skip bot messages, edits, etc.
    if (!("text" in event) || !event.text) return;

    const mapping = store.getBySlackTs(event.thread_ts);
    if (!mapping || !mapping.issueId) return;

    try {
      await client.addComment(mapping.issueId, event.text, {
        interrupt: false,
      });
      console.log(
        `Forwarded thread reply to issue ${mapping.issueId}: "${event.text.slice(0, 50)}..."`
      );
    } catch (err) {
      console.error(
        `Failed to forward thread reply to issue ${mapping.issueId}:`,
        err
      );
      await say({
        text: `:x: Failed to forward your reply to Paperclip: ${err}`,
        thread_ts: event.thread_ts,
      });
    }
  });
}
