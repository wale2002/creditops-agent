import { randomUUID } from "node:crypto";

import {
  calculateFinancialRatios,
  getBorrowerProfile,
  getFacilities,
  getFinancialStatements,
  identifyMissingDocuments,
  testCovenants,
} from "./credit-tools.js";
import {
  searchCreditPolicy,
  type PolicyChunk,
} from "./policy-search.js";

export type AgentRole =
  | "BANKER"
  | "CREDIT_OFFICER"
  | "SYSTEM_MONITOR";

export type AgentToolName =
  | "getBorrowerProfile"
  | "getFacilities"
  | "getFinancialStatements"
  | "calculateFinancialRatios"
  | "testCovenants"
  | "identifyMissingDocuments"
  | "searchCreditPolicy";

export interface ToolExecutionContext {
  actorId: string;
  role: AgentRole;
  correlationId: string;
}

export interface AuditEvent {
  id: string;
  occurredAt: string;
  correlationId: string;
  actorId: string;
  actorRole: AgentRole;
  toolName: AgentToolName;
  input: Record<string, unknown>;
  outcome: "SUCCESS" | "ERROR" | "DENIED";
  resultCount?: number;
  error?: string;
}

export class ToolPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolPermissionError";
  }
}

const TOOL_PERMISSIONS: Record<
  AgentToolName,
  readonly AgentRole[]
> = {
  getBorrowerProfile: ["BANKER", "CREDIT_OFFICER"],
  getFacilities: ["BANKER", "CREDIT_OFFICER"],
  getFinancialStatements: [
    "BANKER",
    "CREDIT_OFFICER",
    "SYSTEM_MONITOR",
  ],
  calculateFinancialRatios: [
    "BANKER",
    "CREDIT_OFFICER",
    "SYSTEM_MONITOR",
  ],
  testCovenants: [
    "BANKER",
    "CREDIT_OFFICER",
    "SYSTEM_MONITOR",
  ],
  identifyMissingDocuments: [
    "BANKER",
    "CREDIT_OFFICER",
    "SYSTEM_MONITOR",
  ],
  searchCreditPolicy: [
    "BANKER",
    "CREDIT_OFFICER",
    "SYSTEM_MONITOR",
  ],
};

function requireString(
  input: Record<string, unknown>,
  field: string,
): string {
  const value = input[field];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }

  return value;
}

function readSearchLimit(
  input: Record<string, unknown>,
): number {
  const value = input.limit;

  if (value === undefined) {
    return 3;
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 10
  ) {
    throw new TypeError(
      "limit must be an integer between 1 and 10",
    );
  }

  return value;
}

export class AuditedToolExecutor {
  private readonly auditEvents: AuditEvent[] = [];

  constructor(
    private readonly policyChunks: readonly PolicyChunk[],
    private readonly clock: () => Date = () => new Date(),
    private readonly idFactory: () => string = randomUUID,
  ) {}

  getAuditEvents(): AuditEvent[] {
    return structuredClone(this.auditEvents);
  }

  execute(
    toolName: AgentToolName,
    input: Record<string, unknown>,
    context: ToolExecutionContext,
  ): unknown {
    const eventBase = {
      id: this.idFactory(),
      occurredAt: this.clock().toISOString(),
      correlationId: context.correlationId,
      actorId: context.actorId,
      actorRole: context.role,
      toolName,
      input: structuredClone(input),
    };

    try {
      if (!TOOL_PERMISSIONS[toolName].includes(context.role)) {
        throw new ToolPermissionError(
          `${context.role} cannot execute ${toolName}`,
        );
      }

      const result = this.runTool(toolName, input);
      const resultCount = Array.isArray(result)
        ? result.length
        : 1;

      this.auditEvents.push({
        ...eventBase,
        outcome: "SUCCESS",
        resultCount,
      });

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown tool error";

      this.auditEvents.push({
        ...eventBase,
        outcome:
          error instanceof ToolPermissionError
            ? "DENIED"
            : "ERROR",
        error: message,
      });

      throw error;
    }
  }

  private runTool(
    toolName: AgentToolName,
    input: Record<string, unknown>,
  ): unknown {
    switch (toolName) {
      case "getBorrowerProfile":
        return getBorrowerProfile(
          requireString(input, "borrowerId"),
        );

      case "getFacilities":
        return getFacilities(
          requireString(input, "borrowerId"),
        );

      case "getFinancialStatements":
        return getFinancialStatements(
          requireString(input, "borrowerId"),
        );

      case "calculateFinancialRatios":
        return calculateFinancialRatios(
          requireString(input, "borrowerId"),
        );

      case "testCovenants":
        return testCovenants(
          requireString(input, "borrowerId"),
        );

      case "identifyMissingDocuments":
        return identifyMissingDocuments(
          requireString(input, "borrowerId"),
        );

      case "searchCreditPolicy":
        return searchCreditPolicy(
          requireString(input, "query"),
          this.policyChunks,
          readSearchLimit(input),
        );
    }
  }
}