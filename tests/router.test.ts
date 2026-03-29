import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ChannelRouter } from "../src/router.js";
import type { ActivityLog } from "../src/paperclip/types.js";

function makeEvent(overrides: Partial<ActivityLog> = {}): ActivityLog {
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

describe("ChannelRouter", () => {
  let router: ChannelRouter;

  beforeEach(() => {
    router = new ChannelRouter({
      default: "#agent-updates",
      routes: [
        { match: { action: "approval.created" }, channel: "#approvals" },
        { match: { action: "budget.warning" }, channel: "#cost-alerts" },
        { match: { action: "budget.exhausted" }, channel: "#cost-alerts" },
        { match: { agentId: "agent-ceo" }, channel: "#ceo-reports" },
      ],
    });

    // Manually populate the channel ID cache (normally done via resolveChannelIds)
    (router as any).channelIdCache.set("#agent-updates", "C001");
    (router as any).channelIdCache.set("#approvals", "C002");
    (router as any).channelIdCache.set("#cost-alerts", "C003");
    (router as any).channelIdCache.set("#ceo-reports", "C004");
  });

  it("routes to default channel when no rules match", () => {
    const event = makeEvent({ action: "issue.updated" });
    assert.equal(router.route(event), "C001");
  });

  it("routes approval events to #approvals", () => {
    const event = makeEvent({ action: "approval.created" });
    assert.equal(router.route(event), "C002");
  });

  it("routes budget warning to #cost-alerts", () => {
    const event = makeEvent({ action: "budget.warning" });
    assert.equal(router.route(event), "C003");
  });

  it("routes budget exhausted to #cost-alerts", () => {
    const event = makeEvent({ action: "budget.exhausted" });
    assert.equal(router.route(event), "C003");
  });

  it("matches on agentId field", () => {
    const event = makeEvent({ agentId: "agent-ceo", action: "issue.updated" });
    assert.equal(router.route(event), "C004");
  });

  it("uses first matching rule (top-down)", () => {
    // An approval.created event from the CEO agent should match approval rule first
    const event = makeEvent({ action: "approval.created", agentId: "agent-ceo" });
    assert.equal(router.route(event), "C002");
  });

  it("matches on details properties", () => {
    const customRouter = new ChannelRouter({
      default: "#general",
      routes: [
        { match: { projectId: "proj-alpha" }, channel: "#project-alpha" },
      ],
    });
    (customRouter as any).channelIdCache.set("#general", "C010");
    (customRouter as any).channelIdCache.set("#project-alpha", "C011");

    const event = makeEvent({
      details: { projectId: "proj-alpha" },
    });
    assert.equal(customRouter.route(event), "C011");
  });

  it("returns null when channel not resolved", () => {
    const emptyRouter = new ChannelRouter({
      default: "#nonexistent",
      routes: [],
    });
    const event = makeEvent();
    assert.equal(emptyRouter.route(event), null);
  });
});
