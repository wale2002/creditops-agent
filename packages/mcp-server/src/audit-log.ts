import type { AgentRole } from "@creditops/agent-tools";

export type CreditOpsMcpToolName =
  | "creditops.get_relationship"
  | "creditops.get_financial_statements"
  | "creditops.search_credit_policy"
  | "creditops.run_covenant_test"
  | "creditops.get_relationship_review";

export interface McpInvocationAuditEvent {
  id: string;
  occurredAt: string;
  correlationId: string;
  actorId: string;
  actorRole: AgentRole;
  toolName: CreditOpsMcpToolName;
  input: Record<string, unknown>;
  outcome: "SUCCESS" | "ERROR" | "DENIED";
  domainAuditEventIds: string[];
  error?: string;
}

export class InMemoryMcpAuditLog {
  private readonly events: McpInvocationAuditEvent[] = [];

  append(event: McpInvocationAuditEvent): void {
    this.events.push(structuredClone(event));
  }

  getEvents(): McpInvocationAuditEvent[] {
    return structuredClone(this.events);
  }
}
