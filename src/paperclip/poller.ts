import type { App } from "@slack/bolt";
import type { PaperclipClient } from "./client.js";
import type { ActivityLog } from "./types.js";
import type { Store } from "../store.js";
import type { ChannelRouter } from "../router.js";
import {
  issueStatusBlock,
  agentRunBlock,
  budgetWarningBlock,
  approvalRequestBlock,
  genericActivityBlock,
} from "../slack/blocks.js";

export class Poller {
  private client: PaperclipClient;
  private store: Store;
  private router: ChannelRouter;
  private app: App;
  private intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private postedApprovals = new Set<string>();

  constructor(
    client: PaperclipClient,
    store: Store,
    router: ChannelRouter,
    app: App,
    intervalMs: number
  ) {
    this.client = client;
    this.store = store;
    this.router = router;
    this.app = app;
    this.intervalMs = intervalMs;
  }

  start(): void {
    console.log(`Poller started (interval: ${this.intervalMs}ms)`);
    this.poll();
    this.timer = setInterval(() => this.poll(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async poll(): Promise<void> {
    try {
      await Promise.all([this.pollActivity(), this.pollApprovals()]);
    } catch (err) {
      console.error("Poll cycle failed:", err);
    }
  }

  private async pollActivity(): Promise<void> {
    const cursor = this.store.getCursor();
    const allActivity = await this.client.getActivity();

    // Activity comes sorted DESC by createdAt; filter to only new events
    const newEvents = cursor
      ? allActivity.filter((e) => e.createdAt > cursor)
      : allActivity.slice(0, 20); // First run: only last 20 to avoid flooding

    if (newEvents.length === 0) return;

    // Process oldest first
    const sorted = [...newEvents].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const event of sorted) {
      try {
        await this.forwardEvent(event);
      } catch (err) {
        console.error(`Failed to forward event ${event.id}:`, err);
      }
    }

    // Update cursor to latest event
    const latest = sorted[sorted.length - 1];
    if (latest) {
      this.store.setCursor(latest.createdAt);
    }
  }

  private async pollApprovals(): Promise<void> {
    const pendingApprovals = await this.client.getApprovals("pending");

    for (const approval of pendingApprovals) {
      if (this.postedApprovals.has(approval.id)) continue;

      // Check if we already posted this approval (persisted)
      const existing = this.store.getByApprovalId(approval.id);
      if (existing) {
        this.postedApprovals.add(approval.id);
        continue;
      }

      try {
        const channelId = this.router.route({
          action: "approval.created",
          entityType: "approval",
          entityId: approval.id,
          details: { type: approval.type },
        } as unknown as ActivityLog);

        if (!channelId) continue;

        const result = await this.app.client.chat.postMessage({
          channel: channelId,
          blocks: approvalRequestBlock(approval),
          text: `Approval requested: ${approval.title}`,
        });

        if (result.ts) {
          this.store.saveMessage({
            slackTs: result.ts,
            channelId,
            issueId: "",
            approvalId: approval.id,
          });
        }

        this.postedApprovals.add(approval.id);
      } catch (err) {
        console.error(`Failed to post approval ${approval.id}:`, err);
      }
    }
  }

  private async forwardEvent(event: ActivityLog): Promise<void> {
    const channelId = this.router.route(event);
    if (!channelId) return;

    const blocks = this.buildBlocks(event);
    const result = await this.app.client.chat.postMessage({
      channel: channelId,
      blocks,
      text: `${event.action}: ${event.entityType}/${event.entityId}`,
    });

    if (result.ts && event.entityType === "issue") {
      this.store.saveMessage({
        slackTs: result.ts,
        channelId,
        issueId: event.entityId,
      });
    }
  }

  private buildBlocks(event: ActivityLog) {
    const action = event.action;

    if (action.startsWith("issue.") && event.details?.status) {
      return issueStatusBlock(event);
    }
    if (action === "agent.run_completed" || action === "heartbeat.completed") {
      return agentRunBlock(event);
    }
    if (action === "budget.warning" || action === "budget.exhausted") {
      return budgetWarningBlock(event);
    }
    return genericActivityBlock(event);
  }
}
