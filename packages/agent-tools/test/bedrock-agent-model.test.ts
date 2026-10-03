import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ConverseCommand,
  type ConverseCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";

import {
  BedrockAgentModel,
  BedrockResponseError,
  type BedrockConverseClient,
  toBedrockMessages,
} from "../src/bedrock-agent-model.js";
import { CREDIT_AGENT_TOOLS } from "../src/agent-tool-definitions.js";
import type {
  AgentMessage,
  AgentModelRequest,
} from "../src/agent-model.js";

class FakeBedrockClient implements BedrockConverseClient {
  readonly commands: ConverseCommand[] = [];

  constructor(private readonly output: ConverseCommandOutput) {}

  async send(command: ConverseCommand): Promise<ConverseCommandOutput> {
    this.commands.push(command);
    return structuredClone(this.output);
  }
}

function request(messages: AgentMessage[]): AgentModelRequest {
  return {
    systemPrompt: "Use tools and never make a final lending decision.",
    messages,
    tools: CREDIT_AGENT_TOOLS,
  };
}

describe("Bedrock agent model", () => {
  it("groups consecutive tool results into one Bedrock user message", () => {
    const messages: AgentMessage[] = [
      {
        role: "user",
        text: "Review Atlas Manufacturing.",
      },
      {
        role: "assistant",
        text: "I will calculate and test.",
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
        role: "tool",
        toolCallId: "call-ratios",
        name: "calculateFinancialRatios",
        result: { dscr: 1.18 },
        isError: false,
      },
      {
        role: "tool",
        toolCallId: "call-covenants",
        name: "testCovenants",
        result: [{ status: "BREACH" }],
        isError: false,
      },
    ];

    const converted = toBedrockMessages(messages);

    assert.equal(converted.length, 3);
    assert.equal(converted[0]?.role, "user");
    assert.equal(converted[1]?.role, "assistant");
    assert.equal(converted[2]?.role, "user");
    assert.equal(converted[1]?.content?.length, 3);
    assert.equal(converted[2]?.content?.length, 2);
    assert.equal(
      converted[2]?.content?.[0]?.toolResult?.toolUseId,
      "call-ratios",
    );
    assert.equal(
      converted[2]?.content?.[1]?.toolResult?.toolUseId,
      "call-covenants",
    );
    assert.deepEqual(
      converted[2]?.content?.[0]?.toolResult?.content?.[0]?.json,
      { result: { dscr: 1.18 } },
    );
    assert.deepEqual(
      converted[2]?.content?.[1]?.toolResult?.content?.[0]?.json,
      { result: [{ status: "BREACH" }] },
    );
  });

  it("translates a Bedrock tool-use response into agent tool calls", async () => {
    const client = new FakeBedrockClient({
      $metadata: {},
      stopReason: "tool_use",
      output: {
        message: {
          role: "assistant",
          content: [
            { text: "I will retrieve the borrower profile." },
            {
              toolUse: {
                toolUseId: "bedrock-call-1",
                name: "getBorrowerProfile",
                input: { borrowerId: "atlas-manufacturing" },
              },
            },
          ],
        },
      },
    });
    const model = new BedrockAgentModel({
      modelId: "test-model",
      client,
      temperature: 0,
      maxTokens: 800,
    });

    const response = await model.respond(
      request([
        {
          role: "user",
          text: "Review Atlas Manufacturing.",
        },
      ]),
    );

    assert.equal(response.kind, "tool_calls");
    if (response.kind === "tool_calls") {
      assert.equal(response.toolCalls[0]?.id, "bedrock-call-1");
      assert.equal(response.toolCalls[0]?.name, "getBorrowerProfile");
      assert.deepEqual(response.toolCalls[0]?.input, {
        borrowerId: "atlas-manufacturing",
      });
    }

    const commandInput = client.commands[0]?.input;
    assert.equal(commandInput?.modelId, "test-model");
    assert.equal(commandInput?.toolConfig?.tools?.length, 7);
    assert.equal(commandInput?.inferenceConfig?.temperature, 0);
    assert.equal(commandInput?.inferenceConfig?.maxTokens, 800);
  });

  it("translates Bedrock text into a final agent response", async () => {
    const client = new FakeBedrockClient({
      $metadata: {},
      stopReason: "end_turn",
      output: {
        message: {
          role: "assistant",
          content: [
            {
              text:
                "<thinking>Internal planning.</thinking>\n\n" +
                "Draft complete. Human approval is required.",
            },
          ],
        },
      },
    });
    const model = new BedrockAgentModel({
      modelId: "test-model",
      client,
    });

    const response = await model.respond(
      request([{ role: "user", text: "Review Atlas." }]),
    );

    assert.deepEqual(response, {
      kind: "final",
      text: "Draft complete. Human approval is required.",
    });
  });

  it("rejects an empty Bedrock response", async () => {
    const client = new FakeBedrockClient({
      $metadata: {},
      stopReason: "end_turn",
      output: {
        message: {
          role: "assistant",
          content: [],
        },
      },
    });
    const model = new BedrockAgentModel({
      modelId: "test-model",
      client,
    });

    await assert.rejects(
      model.respond(
        request([{ role: "user", text: "Review Atlas." }]),
      ),
      BedrockResponseError,
    );
  });
});
