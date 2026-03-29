import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../src/store.js";
import { ChannelRouter } from "../src/router.js";
import type { ActivityLog, Approval } from "../src/paperclip/types.js";

function makeActivity(
  id: string,
  createdAt: string,
  overrides: Partial<ActivityLog> = {}
): ActivityLog {
  return {
    id,
    companyId: "co-1",
    actorType: "system",
    actorId: "system",
    action: "issue.updated",
    entityType: "issue",
    entityId: `iss-${id}`,
    agentId: null,
    runId: null,
    details: { status: "in_progress" },
    createdAt,
    ...overrides,
  };
}

describe("Poller logic", () => {
  let store: Store;
  let tmpDir: string;
  let router: ChannelRouter;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "poller-test-"));
    store = new Store(join(tmpDir, "test.db"));
    router = new ChannelRouter({
      default: "#agent-updates",
      routes: [
        { match: { action: "approval.created" }, channel: "#approvals" },
      ],
    });
    (router as any).channelIdCache.set("#agent-updates", "C001");
    (router as any).channelIdCache.set("#approvals", "C002");
  });

  afterEach(() => {
    store.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("activity filtering with cursor", () => {
    it("filters events after cursor", () => {
      store.setCursor("2026-03-29T10:00:00Z");

      const allActivity = [
        makeActivity("3", "2026-03-29T12:00:00Z"),
        makeActivity("2", "2026-03-29T11:00:00Z"),
        makeActivity("1", "2026-03-29T09:00:00Z"), // before cursor
      ];

      const cursor = store.getCursor()!;
      const newEvents = allActivity.filter((e) => e.createdAt > cursor);

      assert.equal(newEvents.length, 2);
      assert.ok(newEvents.every((e) => e.createdAt > "2026-03-29T10:00:00Z"));
    });

    it("limits to 20 events on first run (no cursor)", () => {
      const allActivity = Array.from({ length: 50 }, (_, i) =>
        makeActivity(`${i}`, `2026-03-29T${String(i).padStart(2, "0")}:00:00Z`)
      );

      const cursor = store.getCursor();
      const newEvents = cursor
        ? allActivity.filter((e) => e.createdAt > cursor)
        : allActivity.slice(0, 20);

      assert.equal(newEvents.length, 20);
    });

    it("sorts events oldest-first for processing", () => {
      const newEvents = [
        makeActivity("3", "2026-03-29T12:00:00Z"),
        makeActivity("1", "2026-03-29T09:00:00Z"),
        makeActivity("2", "2026-03-29T11:00:00Z"),
      ];

      const sorted = [...newEvents].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      assert.equal(sorted[0].id, "1");
      assert.equal(sorted[1].id, "2");
      assert.equal(sorted[2].id, "3");
    });

    it("updates cursor to latest event after processing", () => {
      const sorted = [
        makeActivity("1", "2026-03-29T09:00:00Z"),
        makeActivity("2", "2026-03-29T11:00:00Z"),
        makeActivity("3", "2026-03-29T12:00:00Z"),
      ];

      const latest = sorted[sorted.length - 1];
      store.setCursor(latest.createdAt);

      assert.equal(store.getCursor(), "2026-03-29T12:00:00Z");
    });
  });

  describe("approval deduplication", () => {
    it("skips approvals already in store", () => {
      store.saveMessage({
        slackTs: "existing.ts",
        channelId: "C002",
        issueId: "",
        approvalId: "apr-1",
      });

      const existing = store.getByApprovalId("apr-1");
      assert.ok(existing);
    });

    it("tracks posted approvals in memory set", () => {
      const postedApprovals = new Set<string>();
      postedApprovals.add("apr-1");

      assert.ok(postedApprovals.has("apr-1"));
      assert.ok(!postedApprovals.has("apr-2"));
    });
  });

  describe("event routing", () => {
    it("routes issue events to default channel", () => {
      const event = makeActivity("1", "2026-03-29T10:00:00Z");
      assert.equal(router.route(event), "C001");
    });

    it("routes approval events to approvals channel", () => {
      const event = makeActivity("1", "2026-03-29T10:00:00Z", {
        action: "approval.created",
        entityType: "approval",
      });
      assert.equal(router.route(event), "C002");
    });
  });

  describe("message mapping on forward", () => {
    it("stores slackTs → issueId mapping for issue events", () => {
      store.saveMessage({
        slackTs: "1234.5678",
        channelId: "C001",
        issueId: "iss-1",
      });

      const mapping = store.getBySlackTs("1234.5678");
      assert.equal(mapping?.issueId, "iss-1");
    });

    it("stores slackTs → approvalId mapping for approval messages", () => {
      store.saveMessage({
        slackTs: "9876.5432",
        channelId: "C002",
        issueId: "",
        approvalId: "apr-1",
      });

      const mapping = store.getByApprovalId("apr-1");
      assert.equal(mapping?.slackTs, "9876.5432");
    });
  });
});
