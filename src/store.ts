import Database from "better-sqlite3";

export interface MessageMapping {
  slackTs: string;
  channelId: string;
  issueId: string;
  approvalId?: string;
}

export class Store {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cursor (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_seen_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS message_map (
        slack_ts TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        issue_id TEXT,
        approval_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (slack_ts, channel_id)
      );

      CREATE INDEX IF NOT EXISTS idx_message_map_issue
        ON message_map(issue_id);

      CREATE INDEX IF NOT EXISTS idx_message_map_approval
        ON message_map(approval_id);
    `);
  }

  getCursor(): string | null {
    const row = this.db
      .prepare("SELECT last_seen_at FROM cursor WHERE id = 1")
      .get() as { last_seen_at: string } | undefined;
    return row?.last_seen_at ?? null;
  }

  setCursor(lastSeenAt: string): void {
    this.db
      .prepare(
        `INSERT INTO cursor (id, last_seen_at) VALUES (1, ?)
         ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at`
      )
      .run(lastSeenAt);
  }

  saveMessage(mapping: MessageMapping): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO message_map (slack_ts, channel_id, issue_id, approval_id)
         VALUES (?, ?, ?, ?)`
      )
      .run(
        mapping.slackTs,
        mapping.channelId,
        mapping.issueId,
        mapping.approvalId ?? null
      );
  }

  getBySlackTs(slackTs: string): MessageMapping | null {
    const row = this.db
      .prepare(
        "SELECT slack_ts, channel_id, issue_id, approval_id FROM message_map WHERE slack_ts = ?"
      )
      .get(slackTs) as
      | {
          slack_ts: string;
          channel_id: string;
          issue_id: string;
          approval_id: string | null;
        }
      | undefined;

    if (!row) return null;
    return {
      slackTs: row.slack_ts,
      channelId: row.channel_id,
      issueId: row.issue_id,
      approvalId: row.approval_id ?? undefined,
    };
  }

  getByApprovalId(approvalId: string): MessageMapping | null {
    const row = this.db
      .prepare(
        "SELECT slack_ts, channel_id, issue_id, approval_id FROM message_map WHERE approval_id = ? LIMIT 1"
      )
      .get(approvalId) as
      | {
          slack_ts: string;
          channel_id: string;
          issue_id: string;
          approval_id: string | null;
        }
      | undefined;

    if (!row) return null;
    return {
      slackTs: row.slack_ts,
      channelId: row.channel_id,
      issueId: row.issue_id,
      approvalId: row.approval_id ?? undefined,
    };
  }

  close(): void {
    this.db.close();
  }
}
