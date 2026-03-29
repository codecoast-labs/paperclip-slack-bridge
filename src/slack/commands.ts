import type { App } from "@slack/bolt";
import type { PaperclipClient } from "../paperclip/client.js";
import { agentStatusBlock, costSummaryBlock } from "./blocks.js";

export function parseFlags(text: string): { title: string; flags: Record<string, string> } {
  const flagRegex = /--(\w+)\s+(?:"([^"]+)"|(\S+))/g;
  const flags: Record<string, string> = {};
  let cleaned = text;

  let match: RegExpExecArray | null;
  while ((match = flagRegex.exec(text)) !== null) {
    flags[match[1]] = match[2] ?? match[3];
    cleaned = cleaned.replace(match[0], "");
  }

  return { title: cleaned.trim().replace(/^["']|["']$/g, ""), flags };
}

export function registerCommands(app: App, client: PaperclipClient): void {
  // /pc-task "Fix login bug" --assign CTO --project "Website"
  app.command("/pc-task", async ({ command, ack, respond }) => {
    console.log(`[cmd] /pc-task: "${command.text}"`);
    await ack();

    const { title, flags } = parseFlags(command.text);
    if (!title) {
      await respond({ text: "Usage: `/pc-task \"Title\" [--assign agent] [--project name] [--description \"details\"]`", response_type: "ephemeral" });
      return;
    }

    try {
      // If --assign is given, resolve agent name to ID
      let assigneeAgentId: string | undefined;
      if (flags.assign) {
        const agents = await client.getAgents();
        const found = agents.find(
          (a) => a.name.toLowerCase() === flags.assign.toLowerCase() ||
                 a.role.toLowerCase() === flags.assign.toLowerCase()
        );
        if (found) assigneeAgentId = found.id;
      }

      const issue = await client.createIssue({
        title,
        assigneeAgentId,
        description: flags.description,
      });

      await respond({
        text: `:white_check_mark: Created issue *${issue.identifier ?? issue.id}*: ${title}${assigneeAgentId ? `\nAssigned to: ${flags.assign}` : ""}`,
        response_type: "in_channel",
      });
    } catch (err) {
      console.error("Failed to create task:", err);
      await respond({ text: `:x: Failed to create task: ${err}`, response_type: "ephemeral" });
    }
  });

  // /pc-status [agent]
  app.command("/pc-status", async ({ command, ack, respond }) => {
    console.log(`[cmd] /pc-status: "${command.text}"`);
    await ack();

    try {
      const agents = await client.getAgents();
      const filter = command.text.trim().toLowerCase();

      const filtered = filter
        ? agents.filter(
            (a) =>
              a.name.toLowerCase().includes(filter) ||
              a.role.toLowerCase().includes(filter)
          )
        : agents;

      await respond({
        blocks: agentStatusBlock(filtered),
        text: `Agent status (${filtered.length} agents)`,
        response_type: "ephemeral",
      });
    } catch (err) {
      console.error("Failed to get status:", err);
      await respond({ text: `:x: Failed to get status: ${err}`, response_type: "ephemeral" });
    }
  });

  // /pc-costs
  app.command("/pc-costs", async ({ ack, respond }) => {
    console.log("[cmd] /pc-costs");
    await ack();

    try {
      const [summary, byAgent] = await Promise.all([
        client.getCostsSummary(),
        client.getCostsByAgent(),
      ]);
      await respond({
        blocks: costSummaryBlock(summary, byAgent),
        text: `Cost summary: $${(summary.spendCents / 100).toFixed(2)}`,
        response_type: "ephemeral",
      });
    } catch (err) {
      console.error("Failed to get costs:", err);
      await respond({ text: `:x: Failed to get costs: ${err}`, response_type: "ephemeral" });
    }
  });

  // /pc-pause <agent>
  app.command("/pc-pause", async ({ command, ack, respond }) => {
    await ack();

    const agentName = command.text.trim();
    if (!agentName) {
      await respond({ text: "Usage: `/pc-pause <agent name>`", response_type: "ephemeral" });
      return;
    }

    try {
      const agents = await client.getAgents();
      const found = agents.find(
        (a) =>
          a.name.toLowerCase() === agentName.toLowerCase() ||
          a.role.toLowerCase() === agentName.toLowerCase()
      );

      if (!found) {
        await respond({ text: `:x: Agent "${agentName}" not found`, response_type: "ephemeral" });
        return;
      }

      await client.pauseAgent(found.id);
      await respond({
        text: `:double_vertical_bar: Paused agent *${found.name}* (${found.role})`,
        response_type: "in_channel",
      });
    } catch (err) {
      console.error("Failed to pause agent:", err);
      await respond({ text: `:x: Failed to pause agent: ${err}`, response_type: "ephemeral" });
    }
  });

  // /pc-approve <approvalId>
  app.command("/pc-approve", async ({ command, ack, respond }) => {
    await ack();

    const approvalId = command.text.trim();
    if (!approvalId) {
      await respond({ text: "Usage: `/pc-approve <approvalId>`", response_type: "ephemeral" });
      return;
    }

    try {
      await client.approveApproval(approvalId);
      await respond({
        text: `:white_check_mark: Approved: ${approvalId}`,
        response_type: "in_channel",
      });
    } catch (err) {
      console.error("Failed to approve:", err);
      await respond({ text: `:x: Failed to approve: ${err}`, response_type: "ephemeral" });
    }
  });
}
