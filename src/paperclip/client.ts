import type { Config } from "../config.js";
import type {
  ActivityLog,
  Agent,
  Approval,
  CostSummary,
  CostByAgent,
  Issue,
} from "./types.js";

export class PaperclipClient {
  private baseUrl: string;
  private apiKey: string;
  private companyId: string;

  constructor(config: Config) {
    this.baseUrl = config.paperclip.apiUrl.replace(/\/$/, "");
    this.apiKey = config.paperclip.apiKey;
    this.companyId = config.paperclip.companyId;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Paperclip API ${method} ${path} returned ${res.status}: ${text}`
      );
    }

    return res.json() as Promise<T>;
  }

  private co(path: string): string {
    return `/companies/${this.companyId}${path}`;
  }

  async getActivity(filters?: {
    agentId?: string;
    entityType?: string;
  }): Promise<ActivityLog[]> {
    const params = new URLSearchParams();
    if (filters?.agentId) params.set("agentId", filters.agentId);
    if (filters?.entityType) params.set("entityType", filters.entityType);
    const qs = params.toString();
    return this.request<ActivityLog[]>(
      "GET",
      `${this.co("/activity")}${qs ? `?${qs}` : ""}`
    );
  }

  async getAgents(): Promise<Agent[]> {
    return this.request<Agent[]>("GET", this.co("/agents"));
  }

  async getAgent(agentId: string): Promise<Agent> {
    return this.request<Agent>("GET", this.co(`/agents/${agentId}`));
  }

  async createIssue(data: {
    title: string;
    assigneeAgentId?: string;
    projectId?: string;
    description?: string;
    status?: string;
  }): Promise<Issue> {
    return this.request<Issue>("POST", this.co("/issues"), {
      status: "todo",
      ...data,
    });
  }

  async addComment(
    issueId: string,
    body: string,
    opts?: { reopen?: boolean; interrupt?: boolean }
  ): Promise<unknown> {
    return this.request("POST", `/issues/${issueId}/comments`, {
      body,
      ...opts,
    });
  }

  async getApprovals(status?: string): Promise<Approval[]> {
    const qs = status ? `?status=${status}` : "";
    return this.request<Approval[]>(
      "GET",
      `${this.co("/approvals")}${qs}`
    );
  }

  async approveApproval(approvalId: string): Promise<unknown> {
    return this.request("POST", `/approvals/${approvalId}/approve`, {});
  }

  async rejectApproval(approvalId: string): Promise<unknown> {
    return this.request("POST", `/approvals/${approvalId}/reject`, {});
  }

  async getCostsSummary(): Promise<CostSummary> {
    return this.request<CostSummary>("GET", this.co("/costs/summary"));
  }

  async getCostsByAgent(): Promise<CostByAgent[]> {
    return this.request<CostByAgent[]>("GET", this.co("/costs/by-agent"));
  }

  async pauseAgent(agentId: string): Promise<Agent> {
    return this.request<Agent>("PATCH", this.co(`/agents/${agentId}`), {
      status: "paused",
    });
  }
}
