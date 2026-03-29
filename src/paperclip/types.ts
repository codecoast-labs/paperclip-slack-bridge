export interface ActivityLog {
  id: string;
  companyId: string;
  actorType: "agent" | "user" | "system";
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  agentId: string | null;
  runId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface Agent {
  id: string;
  companyId: string;
  name: string;
  role: string;
  status: string;
  adapterType: string;
  createdAt: string;
  [key: string]: unknown;
}

export interface Issue {
  id: string;
  companyId: string;
  identifier: string;
  title: string;
  status: string;
  assigneeAgentId: string | null;
  projectId: string | null;
  createdAt: string;
  [key: string]: unknown;
}

export interface Approval {
  id: string;
  companyId: string;
  type: string;
  status: "pending" | "approved" | "rejected" | "revision_requested";
  title: string;
  description: string | null;
  requestedByAgentId: string | null;
  requestedByUserId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  [key: string]: unknown;
}

export interface CostSummary {
  companyId: string;
  spendCents: number;
  budgetCents: number;
  utilizationPercent: number;
}

export interface CostByAgent {
  agentId: string;
  agentName: string;
  agentStatus: string;
  costCents: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}
