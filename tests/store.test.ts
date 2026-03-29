import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../src/store.js";

describe("Store", () => {
  let store: Store;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "bridge-test-"));
    store = new Store(join(tmpDir, "test.db"));
  });

  afterEach(() => {
    store.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("cursor", () => {
    it("returns null when no cursor is set", () => {
      assert.equal(store.getCursor(), null);
    });

    it("sets and gets cursor", () => {
      store.setCursor("2026-03-29T10:00:00Z");
      assert.equal(store.getCursor(), "2026-03-29T10:00:00Z");
    });

    it("updates cursor on subsequent set", () => {
      store.setCursor("2026-03-29T10:00:00Z");
      store.setCursor("2026-03-29T11:00:00Z");
      assert.equal(store.getCursor(), "2026-03-29T11:00:00Z");
    });
  });

  describe("message mapping", () => {
    it("saves and retrieves by slackTs", () => {
      store.saveMessage({
        slackTs: "1234.5678",
        channelId: "C001",
        issueId: "issue-1",
      });

      const result = store.getBySlackTs("1234.5678");
      assert.deepEqual(result, {
        slackTs: "1234.5678",
        channelId: "C001",
        issueId: "issue-1",
        approvalId: undefined,
      });
    });

    it("returns null for unknown slackTs", () => {
      assert.equal(store.getBySlackTs("unknown"), null);
    });

    it("saves and retrieves by approvalId", () => {
      store.saveMessage({
        slackTs: "1234.5678",
        channelId: "C001",
        issueId: "",
        approvalId: "apr-1",
      });

      const result = store.getByApprovalId("apr-1");
      assert.deepEqual(result, {
        slackTs: "1234.5678",
        channelId: "C001",
        issueId: "",
        approvalId: "apr-1",
      });
    });

    it("returns null for unknown approvalId", () => {
      assert.equal(store.getByApprovalId("unknown"), null);
    });

    it("overwrites existing mapping on same slackTs+channelId", () => {
      store.saveMessage({
        slackTs: "1234.5678",
        channelId: "C001",
        issueId: "issue-1",
      });
      store.saveMessage({
        slackTs: "1234.5678",
        channelId: "C001",
        issueId: "issue-2",
      });

      const result = store.getBySlackTs("1234.5678");
      assert.equal(result?.issueId, "issue-2");
    });
  });
});
