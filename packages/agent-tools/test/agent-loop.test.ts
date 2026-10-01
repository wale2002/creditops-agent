import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  AgentLoopLimitError,
  AgentProtocolError,
  runCreditAgent,
} from "../src/agent-loop.js";
import type {
  AgentModel,
  AgentModelRequest,
  AgentModelResponse,
} from "../src/agent-model.js";
import { chunkPolicyDocument } from "../src/policy-search.js";
import {
  AuditedToolExecutor,
  type ToolExecutionContext,
} from "../src/tool-executor.js";

const policyPath = new URL(
  "../../../docs/policies/commercial-credit-policy.md",
  import.meta.url,
);

const policyChunks = chunkPolicyDocument(
  readFileSync(policyPath, "utf8"),
  {
    documentId: "commercial-credit-policy",
    title: "Commercial Credit Policy",
    version: "1.0",
    effectiveDate: "2026-01-01",
  },
);

const context: ToolExecutionContext = {
  actorId: "banker-001",
  role: "BANKER",
  correlationId: "agent-loop-atlas-001",
};

class ScriptedAgentModel implements AgentModel {
  readonly requests: AgentModelRequest[] = [];
  private readonly responses: AgentModelResponse[];

  constructor(responses: AgentModelResponse[]) {
    this.responses = structuredClone(responses);
  }

  async respond(
    request: AgentModelRequest,
  ): Promise<AgentModelResponse> {
    this.requests.push(structuredClone(request));

    const response = this.responses.shift();

    if (!response) {
      throw new Error("Scripted model ran out of responses");
    }

    return structuredClone(response);
  }
}

function createExecutor(): AuditedToolExecutor {
  let eventNumber = 0;

  return new AuditedToolExecutor(
    policyChunks,
    () => new Date("2026-09-30T09:00:00.000Z"),
    () => `audit-${++eventNumber}`,
  );
}

describe("credit agent loop", () => {
  it("runs model-selected tools and returns an audited final answer", async () => {
    const model = new ScriptedAgentModel([
      {
        kind: "tool_calls",
        text: "I will calculate the ratios and test the covenants.",
        toolCalls: [
          {
            id: "call-ratios",
            name: "calculateFinancialRatios",
            input: { borrowerId: "atlas-manufacturing" },
          },
          {
            id: "call-covenants",
            name: "testCovenants",
            input: { borrowerId: "atlas-manufacturing" },
          },
        ],
      },
      {
        kind: "tool_calls",
        text: "I will retrieve policy evidence for the DSCR requirement.",
        toolCalls: [
          {
            id: "call-policy",
            name: "searchCreditPolicy",
            input: {
              query: "minimum DSCR requirement",
              limit: 2,
            },
          },
        ],
      },
      {
        kind: "final",
        text: "Draft review prepared for human credit-officer approval.",
      },
    ]);
    const executor = createExecutor();

    const result = await runCreditAgent({
      model,
      executor,
      context,
      userRequest: "Review Atlas Manufacturing.",
    });

    assert.equal(result.modelTurns, 3);
    assert.match(result.finalText, /human credit-officer approval/i);
    assert.deepEqual(
      result.auditEvents.map((event) => event.toolName),
      [
        "calculateFinancialRatios",
        "testCovenants",
        "searchCreditPolicy",
      ],
    );
    assert.ok(
      result.auditEvents.every((event) => event.outcome === "SUCCESS"),
    );
    assert.equal(model.requests.length, 3);
    assert.equal(model.requests[0]?.tools.length, 7);
    assert.match(model.requests[0]?.systemPrompt ?? "", /Never approve credit/i);
  });

  it("rejects a tool invented by the model", async () => {
    const model = new ScriptedAgentModel([
      {
        kind: "tool_calls",
        text: "I will approve the request.",
        toolCalls: [
          {
            id: "call-approval",
            name: "approveLoan",
            input: { borrowerId: "atlas-manufacturing" },
          },
        ],
      },
    ]);

    await assert.rejects(
      runCreditAgent({
        model,
        executor: createExecutor(),
        context,
        userRequest: "Approve Atlas Manufacturing.",
      }),
      (error: unknown) =>
        error instanceof AgentProtocolError &&
        /unsupported tool: approveLoan/.test(error.message),
    );
  });

  it("returns a tool error to the model so it can recover", async () => {
    const model = new ScriptedAgentModel([
      {
        kind: "tool_calls",
        text: "I will retrieve the borrower.",
        toolCalls: [
          {
            id: "call-missing-borrower",
            name: "getBorrowerProfile",
            input: { borrowerId: "unknown-borrower" },
          },
        ],
      },
      {
        kind: "final",
        text: "I could not find that borrower; please verify the identifier.",
      },
    ]);
    const executor = createExecutor();

    const result = await runCreditAgent({
      model,
      executor,
      context,
      userRequest: "Review an unknown borrower.",
    });

    assert.match(result.finalText, /verify the identifier/i);
    assert.equal(result.auditEvents[0]?.outcome, "ERROR");

    const toolMessage = result.messages.find(
      (message) => message.role === "tool",
    );

    assert.equal(toolMessage?.role, "tool");
    if (toolMessage?.role === "tool") {
      assert.equal(toolMessage.isError, true);
    }
  });

  it("stops a model that never produces a final answer", async () => {
    const model = new ScriptedAgentModel([
      {
        kind: "tool_calls",
        text: "I will retrieve facilities.",
        toolCalls: [
          {
            id: "call-facilities",
            name: "getFacilities",
            input: { borrowerId: "atlas-manufacturing" },
          },
        ],
      },
    ]);

    await assert.rejects(
      runCreditAgent({
        model,
        executor: createExecutor(),
        context,
        userRequest: "Keep reviewing forever.",
        maxModelTurns: 1,
      }),
      AgentLoopLimitError,
    );
  });
});
