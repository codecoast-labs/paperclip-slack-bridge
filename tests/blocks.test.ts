import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  issueStatusBlock,
  agentRunBlock,
  budgetWarningBlock,
  approvalRequestBlock,
  genericActivityBlock,
  agentStatusBlock,
  costSummaryBlock,
} from "../src/slack/blocks.js";
import type { ActivityLog, Approval, Agent, CostSummary, CostByAgent } from "../src/paperclip/types.js";

function makeActivity(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: "evt-1",
    companyId: "co-1",
    actorType: "system",
    actorId: "system",
    action: "issue.updated",
    entityType: "issue",
    entityId: "iss-1",
    agentId: null,
    runId: null,
    details: null,
    createdAt: "2026-03-29T10:00:00Z",
    ...overrides,
  };
}

describe("Block Kit builders", () => {
  describe("issueStatusBlock", () => {
    it("renders status and title from details", () => {
      const blocks = issueStatusBlock(
        makeActivity({
          details: {
            status: "in_progress",
            title: "Fix login bug",
            identifier: "WEB-42",
            assigneeName: "CTO",
            projectName: "Website",
          },
        })
      );

      assert.ok(blocks.length >= 2); // section + divider
      const section = blocks[0];
      assert.equal(section.type, "section");
      const text = (section as any).text.text as string;
      assert.ok(text.includes("WEB-42"));
      assert.ok(text.includes("Fix login bug"));
      assert.ok(text.includes("in progress"));
      assert.ok(text.includes("CTO"));
      assert.ok(text.includes("Website"));
    });

    it("adds View in Paperclip button when URL provided", () => {
      const blocks = issueStatusBlock(
        makeActivity({ details: { status: "done" } }),
        "https://paperclip.example.com"
      );

      const actions = blocks.find((b) => b.type === "actions");
      assert.ok(actions);
    });

    it("omits button when no URL", () => {
      const blocks = issueStatusBlock(
        makeActivity({ details: { status: "done" } })
      );
      const actions = blocks.find((b) => b.type === "actions");
      assert.equal(actions, undefined);
    });
  });

  describe("agentRunBlock", () => {
    it("renders agent name and duration", () => {
      const blocks = agentRunBlock(
        makeActivity({
          details: { agentName: "CTO", durationMs: 45000, cost: 0.1234 },
        })
      );

      const text = (blocks[0] as any).text.text as string;
      assert.ok(text.includes("CTO"));
      assert.ok(text.includes("45s"));
      assert.ok(text.includes("$0.1234"));
    });

    it("uses agentId as fallback for name", () => {
      const blocks = agentRunBlock(
        makeActivity({ agentId: "agent-123", details: {} })
      );
      const text = (blocks[0] as any).text.text as string;
      assert.ok(text.includes("agent-123"));
    });
  });

  describe("budgetWarningBlock", () => {
    it("renders warning for budget.warning", () => {
      const blocks = budgetWarningBlock(
        makeActivity({
          action: "budget.warning",
          details: { agentName: "Coder", spend: 8.0, limit: 10.0 },
        })
      );

      const text = (blocks[0] as any).text.text as string;
      assert.ok(text.includes("warning"));
      assert.ok(text.includes("Coder"));
      assert.ok(text.includes("$8.00"));
      assert.ok(text.includes("$10.00"));
      assert.ok(!text.includes("auto-paused"));
    });

    it("renders exhausted alert with auto-pause note", () => {
      const blocks = budgetWarningBlock(
        makeActivity({
          action: "budget.exhausted",
          details: { agentName: "Coder", spend: 10.0, limit: 10.0 },
        })
      );

      const text = (blocks[0] as any).text.text as string;
      assert.ok(text.includes("exhausted"));
      assert.ok(text.includes("auto-paused"));
    });
  });

  describe("approvalRequestBlock", () => {
    it("renders approval with approve/reject buttons", () => {
      const approval: Approval = {
        id: "apr-1",
        companyId: "co-1",
        type: "hire_agent",
        status: "pending",
        title: "Hire new developer",
        description: "Need a frontend dev",
        requestedByAgentId: "agent-ceo",
        requestedByUserId: null,
        payload: {},
        createdAt: "2026-03-29T10:00:00Z",
      };

      const blocks = approvalRequestBlock(approval);
      const text = (blocks[0] as any).text.text as string;
      assert.ok(text.includes("Hire new developer"));
      assert.ok(text.includes("hire agent"));
      assert.ok(text.includes("agent-ceo"));

      const actions = blocks.find((b) => b.type === "actions") as any;
      assert.ok(actions);
      assert.equal(actions.elements.length, 2);
      assert.equal(actions.elements[0].action_id, "approval_approve");
      assert.equal(actions.elements[0].value, "apr-1");
      assert.equal(actions.elements[1].action_id, "approval_reject");
    });
  });

  describe("genericActivityBlock", () => {
    it("renders action and entity info", () => {
      const blocks = genericActivityBlock(
        makeActivity({
          action: "agent.started",
          entityType: "agent",
          entityId: "agent-1",
          details: { name: "CTO", role: "cto" },
        })
      );

      const text = (blocks[0] as any).text.text as string;
      assert.ok(text.includes("agent.started"));
      assert.ok(text.includes("agent/agent-1"));
      assert.ok(text.includes("CTO"));
    });

    it("filters out object values from details", () => {
      const blocks = genericActivityBlock(
        makeActivity({
          details: { simple: "yes", nested: { deep: true } },
        })
      );

      const text = (blocks[0] as any).text.text as string;
      assert.ok(text.includes("simple"));
      assert.ok(!text.includes("nested"));
    });
  });

  describe("agentStatusBlock", () => {
    it("renders empty state", () => {
      const blocks = agentStatusBlock([]);
      const text = (blocks[0] as any).text.text as string;
      assert.ok(text.includes("No agents found"));
    });

    it("renders agent list with status emojis", () => {
      const agents: Agent[] = [
        { id: "1", companyId: "co-1", name: "Alice", role: "CTO", status: "active", adapterType: "claude_local", createdAt: "" },
        { id: "2", companyId: "co-1", name: "Bob", role: "Dev", status: "paused", adapterType: "codex_local", createdAt: "" },
      ];

      const blocks = agentStatusBlock(agents);
      const text = (blocks[0] as any).text.text as string;
      assert.ok(text.includes("Alice"));
      assert.ok(text.includes("Bob"));
      assert.ok(text.includes(":large_green_circle:"));
      assert.ok(text.includes(":double_vertical_bar:"));
    });
  });

  describe("costSummaryBlock", () => {
    it("renders total and per-agent costs", () => {
      const summary: CostSummary = {
        companyId: "co-1",
        spendCents: 1234,
        budgetCents: 5000,
        utilizationPercent: 24,
      };
      const byAgent: CostByAgent[] = [
        { agentId: "1", agentName: "CTO", agentStatus: "active", costCents: 850, inputTokens: 100, cachedInputTokens: 5000, outputTokens: 2000 },
        { agentId: "2", agentName: "Dev", agentStatus: "idle", costCents: 384, inputTokens: 50, cachedInputTokens: 1000, outputTokens: 500 },
      ];

      const blocks = costSummaryBlock(summary, byAgent);
      const text = (blocks[0] as any).text.text as string;
      assert.ok(text.includes("$12.34"));
      assert.ok(text.includes("$50.00"));
      assert.ok(text.includes("CTO"));
      assert.ok(text.includes("$8.50"));
    });
  });
});
