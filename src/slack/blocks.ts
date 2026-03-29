import type { KnownBlock } from "@slack/types";
import type { ActivityLog, Approval, Agent, CostSummary } from "../paperclip/types.js";

export function issueStatusBlock(
  activity: ActivityLog,
  paperclipUrl?: string
): KnownBlock[] {
  const details = activity.details ?? {};
  const status = (details.status as string) ?? "unknown";
  const title = (details.title as string) ?? (details.identifier as string) ?? activity.entityId;
  const assignee = (details.assigneeName as string) ?? (details.assigneeAgentId as string) ?? "";
  const project = (details.projectName as string) ?? "";
  const identifier = (details.identifier as string) ?? "";

  const statusEmoji: Record<string, string> = {
    todo: ":white_circle:",
    in_progress: ":large_blue_circle:",
    in_review: ":eyes:",
    done: ":white_check_mark:",
    cancelled: ":no_entry_sign:",
  };

  const blocks: KnownBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${statusEmoji[status] ?? ":record_button:"} *${identifier ? `${identifier}: ` : ""}${title}*\nStatus: *${status.replace(/_/g, " ")}*${assignee ? `\nAssigned to: ${assignee}` : ""}${project ? `\nProject: ${project}` : ""}`,
      },
    },
  ];

  if (paperclipUrl) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View in Paperclip" },
          url: `${paperclipUrl}/issues/${activity.entityId}`,
          action_id: "view_in_paperclip",
        },
      ],
    });
  }

  blocks.push({ type: "divider" });
  return blocks;
}

export function agentRunBlock(activity: ActivityLog): KnownBlock[] {
  const details = activity.details ?? {};
  const agentName = (details.agentName as string) ?? activity.agentId ?? "Unknown agent";
  const duration = details.durationMs
    ? `${Math.round((details.durationMs as number) / 1000)}s`
    : "N/A";
  const cost = details.cost != null ? `$${(details.cost as number).toFixed(4)}` : "";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:robot_face: *Agent run completed*\n*Agent:* ${agentName}\n*Duration:* ${duration}${cost ? `\n*Cost:* ${cost}` : ""}`,
      },
    },
    { type: "divider" },
  ];
}

export function budgetWarningBlock(activity: ActivityLog): KnownBlock[] {
  const details = activity.details ?? {};
  const agentName = (details.agentName as string) ?? "Unknown agent";
  const spend = details.spend != null ? `$${(details.spend as number).toFixed(2)}` : "N/A";
  const limit = details.limit != null ? `$${(details.limit as number).toFixed(2)}` : "N/A";
  const isExhausted = activity.action === "budget.exhausted";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${isExhausted ? ":rotating_light:" : ":warning:"} *Budget ${isExhausted ? "exhausted" : "warning"}*\n*Agent:* ${agentName}\n*Spend:* ${spend} / ${limit}${isExhausted ? "\n_Agent has been auto-paused._" : ""}`,
      },
    },
    { type: "divider" },
  ];
}

export function approvalRequestBlock(approval: Approval): KnownBlock[] {
  const requester = approval.requestedByAgentId ?? approval.requestedByUserId ?? "Unknown";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:raised_hand: *Approval requested*\n*${approval.title}*${approval.description ? `\n${approval.description}` : ""}\n*Type:* ${approval.type.replace(/_/g, " ")}\n*Requested by:* ${requester}`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Approve" },
          style: "primary",
          action_id: "approval_approve",
          value: approval.id,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Reject" },
          style: "danger",
          action_id: "approval_reject",
          value: approval.id,
        },
      ],
    },
    { type: "divider" },
  ];
}

export function genericActivityBlock(activity: ActivityLog): KnownBlock[] {
  const details = activity.details ?? {};
  const detailLines = Object.entries(details)
    .filter(([, v]) => v != null && typeof v !== "object")
    .slice(0, 5)
    .map(([k, v]) => `*${k}:* ${v}`)
    .join("\n");

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:clipboard: *${activity.action}*\n*Entity:* ${activity.entityType}/${activity.entityId}${detailLines ? `\n${detailLines}` : ""}`,
      },
    },
    { type: "divider" },
  ];
}

export function agentStatusBlock(agents: Agent[]): KnownBlock[] {
  if (agents.length === 0) {
    return [
      {
        type: "section",
        text: { type: "mrkdwn", text: "No agents found." },
      },
    ];
  }

  const statusEmoji: Record<string, string> = {
    active: ":large_green_circle:",
    idle: ":white_circle:",
    paused: ":double_vertical_bar:",
    error: ":red_circle:",
  };

  const lines = agents.map(
    (a) =>
      `${statusEmoji[a.status] ?? ":grey_question:"} *${a.name}* (${a.role}) — ${a.status}`
  );

  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: lines.join("\n") },
    },
  ];
}

export function costSummaryBlock(summary: CostSummary): KnownBlock[] {
  const lines = [`*Total:* $${summary.totalCost.toFixed(2)}`];
  if (summary.byAgent?.length) {
    lines.push("");
    for (const entry of summary.byAgent.slice(0, 10)) {
      lines.push(`  ${entry.agentName}: $${entry.cost.toFixed(4)}`);
    }
  }

  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: `:money_with_wings: *Cost Summary*\n${lines.join("\n")}` },
    },
  ];
}
