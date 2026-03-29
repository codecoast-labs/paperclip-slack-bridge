import type { App } from "@slack/bolt";
import type { PaperclipClient } from "../paperclip/client.js";

export function registerActions(app: App, client: PaperclipClient): void {
  app.action("approval_approve", async ({ action, ack, respond, body }) => {
    await ack();

    if (!("value" in action) || !action.value) return;
    const approvalId = action.value;
    const user = "user" in body ? body.user.id : "unknown";

    try {
      await client.approveApproval(approvalId);
      await respond({
        text: `:white_check_mark: *Approved* by <@${user}>`,
        replace_original: true,
      });
    } catch (err) {
      console.error(`Failed to approve ${approvalId}:`, err);
      await respond({
        text: `:x: Failed to approve: ${err}`,
        replace_original: false,
      });
    }
  });

  app.action("approval_reject", async ({ action, ack, respond, body }) => {
    await ack();

    if (!("value" in action) || !action.value) return;
    const approvalId = action.value;
    const user = "user" in body ? body.user.id : "unknown";

    try {
      await client.rejectApproval(approvalId);
      await respond({
        text: `:no_entry_sign: *Rejected* by <@${user}>`,
        replace_original: true,
      });
    } catch (err) {
      console.error(`Failed to reject ${approvalId}:`, err);
      await respond({
        text: `:x: Failed to reject: ${err}`,
        replace_original: false,
      });
    }
  });

  // No-op handler for the "View in Paperclip" link button
  app.action("view_in_paperclip", async ({ ack }) => {
    await ack();
  });
}
