import { randomUUID } from "node:crypto";

import {
  AuditedToolExecutor,
  ToolPermissionError,
  orchestrateRelationshipReview,
  type AgentRole,
  type PolicyChunk,
  type ToolExecutionContext,
} from "@creditops/agent-tools";
import { McpServer, type ToolAnnotations } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import {
  InMemoryMcpAuditLog,
  type CreditOpsMcpToolName,
} from "./audit-log.js";
import { loadDefaultPolicyChunks } from "./policy-source.js";

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} satisfies ToolAnnotations;

const borrowerInputSchema = z.object({
  borrowerId: z
    .string()
    .trim()
    .min(1)
    .describe("Exact synthetic borrower ID, for example atlas-manufacturing"),
});

const policySearchInputSchema = z.object({
  query: z.string().trim().min(1).describe("Credit-policy question"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe("Maximum policy sections to return; defaults to 3"),
});

export interface CreditOpsMcpIdentity {
  actorId: string;
  role: AgentRole;
}

export interface CreateCreditOpsMcpServerOptions
  extends CreditOpsMcpIdentity {
  policyChunks?: readonly PolicyChunk[];
  executor?: AuditedToolExecutor;
  auditLog?: InMemoryMcpAuditLog;
  clock?: () => Date;
  idFactory?: () => string;
}

export interface CreditOpsMcpServerRuntime {
  server: McpServer;
  executor: AuditedToolExecutor;
  auditLog: InMemoryMcpAuditLog;
}

const VALID_ROLES: readonly AgentRole[] = [
  "BANKER",
  "CREDIT_OFFICER",
  "SYSTEM_MONITOR",
];

export function readMcpIdentity(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): CreditOpsMcpIdentity {
  const actorId = environment.CREDITOPS_MCP_ACTOR_ID?.trim() || "local-mcp-client";
  const requestedRole = environment.CREDITOPS_MCP_ROLE?.trim() || "BANKER";

  if (!VALID_ROLES.includes(requestedRole as AgentRole)) {
    throw new Error(
      `CREDITOPS_MCP_ROLE must be one of: ${VALID_ROLES.join(", ")}`,
    );
  }

  return {
    actorId,
    role: requestedRole as AgentRole,
  };
}

function resultPayload(
  data: unknown,
  eventId: string,
  correlationId: string,
): Record<string, unknown> {
  return {
    data,
    audit: {
      eventId,
      correlationId,
    },
  };
}

export function createCreditOpsMcpServer(
  options: CreateCreditOpsMcpServerOptions,
): CreditOpsMcpServerRuntime {
  const actorId = options.actorId.trim();

  if (actorId.length === 0) {
    throw new Error("MCP actorId must be a non-empty string");
  }

  const clock = options.clock ?? (() => new Date());
  const idFactory = options.idFactory ?? randomUUID;
  const policyChunks = options.policyChunks ?? loadDefaultPolicyChunks();
  const executor =
    options.executor ??
    new AuditedToolExecutor(policyChunks, clock, idFactory);
  const auditLog = options.auditLog ?? new InMemoryMcpAuditLog();
  const server = new McpServer(
    {
      name: "creditops-read-only",
      version: "1.0.0",
    },
    {
      instructions:
        "Use these tools only with synthetic CreditOps data. Results are evidence for a draft review, never a final lending decision. No tool can approve credit, waive a covenant, or mutate borrower records.",
    },
  );

  async function invoke(
    toolName: CreditOpsMcpToolName,
    input: Record<string, unknown>,
    operation: (context: ToolExecutionContext) => unknown,
  ) {
    const eventId = idFactory();
    const correlationId = `mcp-${idFactory()}`;
    const domainEventOffset = executor.getAuditEvents().length;
    const context: ToolExecutionContext = {
      actorId,
      role: options.role,
      correlationId,
    };

    try {
      const data = operation(context);
      const domainAuditEventIds = executor
        .getAuditEvents()
        .slice(domainEventOffset)
        .map((event) => event.id);

      auditLog.append({
        id: eventId,
        occurredAt: clock().toISOString(),
        correlationId,
        actorId,
        actorRole: options.role,
        toolName,
        input,
        outcome: "SUCCESS",
        domainAuditEventIds,
      });

      const payload = resultPayload(data, eventId, correlationId);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(payload, null, 2),
          },
        ],
        structuredContent: payload,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown MCP tool error";
      const domainAuditEventIds = executor
        .getAuditEvents()
        .slice(domainEventOffset)
        .map((event) => event.id);

      auditLog.append({
        id: eventId,
        occurredAt: clock().toISOString(),
        correlationId,
        actorId,
        actorRole: options.role,
        toolName,
        input,
        outcome: error instanceof ToolPermissionError ? "DENIED" : "ERROR",
        domainAuditEventIds,
        error: message,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                error: message,
                audit: { eventId, correlationId },
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }
  }

  server.registerTool(
    "creditops.get_relationship",
    {
      title: "Get Credit Relationship",
      description:
        "Retrieve one synthetic borrower relationship and its recorded source data. Read only.",
      inputSchema: borrowerInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ borrowerId }) =>
      invoke(
        "creditops.get_relationship",
        { borrowerId },
        (context) =>
          executor.execute(
            "getBorrowerProfile",
            { borrowerId },
            context,
          ),
      ),
  );

  server.registerTool(
    "creditops.get_financial_statements",
    {
      title: "Get Financial Statements",
      description:
        "Retrieve the financial statements recorded for a synthetic borrower. Read only.",
      inputSchema: borrowerInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ borrowerId }) =>
      invoke(
        "creditops.get_financial_statements",
        { borrowerId },
        (context) =>
          executor.execute(
            "getFinancialStatements",
            { borrowerId },
            context,
          ),
      ),
  );

  server.registerTool(
    "creditops.search_credit_policy",
    {
      title: "Search Credit Policy",
      description:
        "Retrieve relevant sections from the synthetic commercial credit policy with citations. Read only.",
      inputSchema: policySearchInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ query, limit }) => {
      const input = limit === undefined ? { query } : { query, limit };

      return invoke(
        "creditops.search_credit_policy",
        input,
        (context) =>
          executor.execute("searchCreditPolicy", input, context),
      );
    },
  );

  server.registerTool(
    "creditops.run_covenant_test",
    {
      title: "Run Covenant Test",
      description:
        "Run deterministic covenant tests for a synthetic borrower. Read only and does not waive a breach.",
      inputSchema: borrowerInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ borrowerId }) =>
      invoke(
        "creditops.run_covenant_test",
        { borrowerId },
        (context) =>
          executor.execute("testCovenants", { borrowerId }, context),
      ),
  );

  server.registerTool(
    "creditops.get_relationship_review",
    {
      title: "Get Draft Relationship Review",
      description:
        "Create an evidence-backed draft relationship review from controlled tools. The result always requires human review and contains no final decision.",
      inputSchema: borrowerInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ borrowerId }) =>
      invoke(
        "creditops.get_relationship_review",
        { borrowerId },
        (context) =>
          orchestrateRelationshipReview(borrowerId, executor, context),
      ),
  );

  return {
    server,
    executor,
    auditLog,
  };
}
