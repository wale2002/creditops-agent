import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  Client,
  InMemoryTransport,
} from "@modelcontextprotocol/client";

import {
  createCreditOpsMcpServer,
  readMcpIdentity,
  type CreditOpsMcpServerRuntime,
} from "../src/server.js";

interface StructuredToolResult {
  data: unknown;
  audit: {
    eventId: string;
    correlationId: string;
  };
}

async function connect(
  role: "BANKER" | "CREDIT_OFFICER" | "SYSTEM_MONITOR" = "BANKER",
): Promise<{
  client: Client;
  runtime: CreditOpsMcpServerRuntime;
}> {
  const runtime = createCreditOpsMcpServer({
    actorId: "mcp-test-actor",
    role,
    clock: () => new Date("2026-10-04T09:00:00.000Z"),
  });
  const client = new Client({
    name: "creditops-test-client",
    version: "1.0.0",
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await runtime.server.connect(serverTransport);
  await client.connect(clientTransport);

  return { client, runtime };
}

function structured(result: {
  structuredContent?: unknown;
}): StructuredToolResult {
  assert.ok(result.structuredContent);
  return result.structuredContent as StructuredToolResult;
}

describe("CreditOps MCP server", () => {
  it("publishes only the five read-oriented CreditOps tools", async () => {
    const { client, runtime } = await connect();

    try {
      const { tools } = await client.listTools();

      assert.deepEqual(
        tools.map((tool) => tool.name),
        [
          "creditops.get_relationship",
          "creditops.get_financial_statements",
          "creditops.search_credit_policy",
          "creditops.run_covenant_test",
          "creditops.get_relationship_review",
        ],
      );
      assert.ok(
        tools.every(
          (tool) =>
            tool.annotations?.readOnlyHint === true &&
            tool.annotations.destructiveHint === false,
        ),
      );
      assert.equal(
        tools.some((tool) => /approve|update|delete|waive/i.test(tool.name)),
        false,
      );
    } finally {
      await client.close();
      await runtime.server.close();
    }
  });

  it("returns a relationship and links MCP and domain audit events", async () => {
    const { client, runtime } = await connect();

    try {
      const result = await client.callTool({
        name: "creditops.get_relationship",
        arguments: { borrowerId: "atlas-manufacturing" },
      });

      assert.notEqual(result.isError, true);
      const payload = structured(result);
      const borrower = payload.data as { id: string; name: string };
      assert.equal(borrower.id, "atlas-manufacturing");
      assert.equal(borrower.name, "Atlas Manufacturing Ltd");

      const [mcpEvent] = runtime.auditLog.getEvents();
      assert.equal(mcpEvent?.outcome, "SUCCESS");
      assert.equal(mcpEvent?.actorId, "mcp-test-actor");
      assert.equal(mcpEvent?.domainAuditEventIds.length, 1);
      assert.equal(
        runtime.executor.getAuditEvents()[0]?.correlationId,
        payload.audit.correlationId,
      );
    } finally {
      await client.close();
      await runtime.server.close();
    }
  });

  it("returns cited policy evidence through MCP", async () => {
    const { client, runtime } = await connect();

    try {
      const result = await client.callTool({
        name: "creditops.search_credit_policy",
        arguments: {
          query: "What is the minimum DSCR requirement?",
          limit: 1,
        },
      });

      assert.notEqual(result.isError, true);
      const evidence = structured(result).data as Array<{
        citation: { document: string; section: string };
      }>;
      assert.equal(evidence.length, 1);
      assert.equal(
        evidence[0]?.citation.section,
        "5.3 — Debt Service Requirements",
      );
      assert.equal(
        evidence[0]?.citation.document,
        "Commercial Credit Policy",
      );
      assert.equal(runtime.auditLog.getEvents()[0]?.outcome, "SUCCESS");
    } finally {
      await client.close();
      await runtime.server.close();
    }
  });

  it("creates a draft review without a lending decision", async () => {
    const { client, runtime } = await connect("CREDIT_OFFICER");

    try {
      const result = await client.callTool({
        name: "creditops.get_relationship_review",
        arguments: { borrowerId: "atlas-manufacturing" },
      });

      assert.notEqual(result.isError, true);
      const review = structured(result).data as {
        status: string;
        finalDecision: unknown;
        policyEvidence: unknown[];
      };
      assert.equal(review.status, "AWAITING_HUMAN_REVIEW");
      assert.equal(review.finalDecision, null);
      assert.ok(review.policyEvidence.length > 0);
      assert.equal(
        runtime.auditLog.getEvents()[0]?.domainAuditEventIds.length,
        8,
      );
    } finally {
      await client.close();
      await runtime.server.close();
    }
  });

  it("enforces RBAC and audits denied MCP calls", async () => {
    const { client, runtime } = await connect("SYSTEM_MONITOR");

    try {
      const result = await client.callTool({
        name: "creditops.get_relationship",
        arguments: { borrowerId: "atlas-manufacturing" },
      });

      assert.equal(result.isError, true);
      assert.equal(runtime.auditLog.getEvents()[0]?.outcome, "DENIED");
      assert.equal(runtime.executor.getAuditEvents()[0]?.outcome, "DENIED");
    } finally {
      await client.close();
      await runtime.server.close();
    }
  });

  it("validates configured MCP identities", () => {
    assert.deepEqual(
      readMcpIdentity({
        CREDITOPS_MCP_ACTOR_ID: "banker-007",
        CREDITOPS_MCP_ROLE: "CREDIT_OFFICER",
      }),
      {
        actorId: "banker-007",
        role: "CREDIT_OFFICER",
      },
    );

    assert.throws(
      () =>
        readMcpIdentity({
          CREDITOPS_MCP_ROLE: "ADMIN",
        }),
      /CREDITOPS_MCP_ROLE must be one of/,
    );
  });
});
