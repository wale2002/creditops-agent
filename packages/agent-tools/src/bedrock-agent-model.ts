import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type ConverseCommandOutput,
  type Message,
  type Tool,
} from "@aws-sdk/client-bedrock-runtime";

import type {
  AgentMessage,
  AgentModel,
  AgentModelRequest,
  AgentModelResponse,
} from "./agent-model.js";

export interface BedrockConverseClient {
  send(command: ConverseCommand): Promise<ConverseCommandOutput>;
}

export interface BedrockAgentModelOptions {
  modelId: string;
  region?: string;
  maxTokens?: number;
  temperature?: number;
  client?: BedrockConverseClient;
}

export class BedrockResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BedrockResponseError";
  }
}

function requireNonEmpty(value: string, field: string): string {
  if (value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }

  return value;
}

function asToolInput(value: unknown): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new BedrockResponseError(
      "Bedrock returned tool input that was not a JSON object",
    );
  }

  return structuredClone(value) as Record<string, unknown>;
}

type JsonDocument =
  | null
  | boolean
  | number
  | string
  | JsonDocument[]
  | { [key: string]: JsonDocument };

function toBedrockDocument(
  value: unknown,
  seen: Set<object> = new Set(),
): JsonDocument {
  if (value === null) {
    return null;
  }

  if (
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Bedrock JSON values must contain finite numbers");
    }

    return value;
  }

  if (typeof value !== "object") {
    throw new TypeError(
      `Bedrock JSON values cannot contain ${typeof value}`,
    );
  }

  if (seen.has(value)) {
    throw new TypeError("Bedrock JSON values cannot contain cycles");
  }

  seen.add(value);

  try {
    if (Array.isArray(value)) {
      return value.map((item) => toBedrockDocument(item, seen));
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        toBedrockDocument(item, seen),
      ]),
    );
  } finally {
    seen.delete(value);
  }
}

export function toBedrockMessages(
  messages: readonly AgentMessage[],
): Message[] {
  const bedrockMessages: Message[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];

    if (!message) {
      continue;
    }

    if (message.role === "user") {
      bedrockMessages.push({
        role: "user",
        content: [{ text: message.text }],
      });
      continue;
    }

    if (message.role === "assistant") {
      const content: ContentBlock[] = [];

      if (message.text.trim().length > 0) {
        content.push({ text: message.text });
      }

      for (const toolCall of message.toolCalls) {
        content.push({
          toolUse: {
            toolUseId: toolCall.id,
            name: toolCall.name,
            input: toBedrockDocument(toolCall.input),
          },
        });
      }

      bedrockMessages.push({
        role: "assistant",
        content,
      });
      continue;
    }

    const toolResults: ContentBlock[] = [];

    while (index < messages.length) {
      const toolMessage = messages[index];

      if (!toolMessage || toolMessage.role !== "tool") {
        index -= 1;
        break;
      }

      toolResults.push({
        toolResult: {
          toolUseId: toolMessage.toolCallId,
          status: toolMessage.isError ? "error" : "success",
          content: [
            {
              json: toBedrockDocument(
                toolMessage.result === undefined
                  ? null
                  : toolMessage.result,
              ),
            },
          ],
        },
      });

      index += 1;
    }

    bedrockMessages.push({
      role: "user",
      content: toolResults,
    });
  }

  return bedrockMessages;
}

function toBedrockTools(request: AgentModelRequest): Tool[] {
  return request.tools.map((tool) => ({
    toolSpec: {
      name: tool.name,
      description: tool.description,
      inputSchema: {
        json: toBedrockDocument(tool.inputSchema),
      },
    },
  }));
}

export class BedrockAgentModel implements AgentModel {
  private readonly client: BedrockConverseClient;
  private readonly modelId: string;
  private readonly maxTokens: number;
  private readonly temperature: number;

  constructor(options: BedrockAgentModelOptions) {
    this.modelId = requireNonEmpty(options.modelId, "modelId");
    this.maxTokens = options.maxTokens ?? 1_500;
    this.temperature = options.temperature ?? 0;

    if (
      !Number.isInteger(this.maxTokens) ||
      this.maxTokens < 1 ||
      this.maxTokens > 8_192
    ) {
      throw new RangeError(
        "maxTokens must be an integer between 1 and 8192",
      );
    }

    if (
      !Number.isFinite(this.temperature) ||
      this.temperature < 0 ||
      this.temperature > 1
    ) {
      throw new RangeError("temperature must be between 0 and 1");
    }

    if (options.client) {
      this.client = options.client;
      return;
    }

    const region = requireNonEmpty(options.region ?? "", "region");
    this.client = new BedrockRuntimeClient({ region });
  }

  async respond(
    request: AgentModelRequest,
  ): Promise<AgentModelResponse> {
    const response = await this.client.send(
      new ConverseCommand({
        modelId: this.modelId,
        system: [{ text: request.systemPrompt }],
        messages: toBedrockMessages(request.messages),
        toolConfig: {
          tools: toBedrockTools(request),
        },
        inferenceConfig: {
          maxTokens: this.maxTokens,
          temperature: this.temperature,
        },
      }),
    );

    const content = response.output?.message?.content;

    if (!content || content.length === 0) {
      throw new BedrockResponseError(
        `Bedrock returned no message content (stop reason: ${response.stopReason ?? "unknown"})`,
      );
    }

    const text = content
      .flatMap((block) => (block.text === undefined ? [] : [block.text]))
      .join("\n")
      .trim();

    const toolCalls = content.flatMap((block) => {
      if (!block.toolUse) {
        return [];
      }

      const id = requireNonEmpty(
        block.toolUse.toolUseId ?? "",
        "toolUseId",
      );
      const name = requireNonEmpty(
        block.toolUse.name ?? "",
        "tool name",
      );

      return [
        {
          id,
          name,
          input: asToolInput(block.toolUse.input),
        },
      ];
    });

    if (toolCalls.length > 0) {
      return {
        kind: "tool_calls",
        text,
        toolCalls,
      };
    }

    if (text.length > 0) {
      return {
        kind: "final",
        text,
      };
    }

    throw new BedrockResponseError(
      `Bedrock returned neither text nor tool calls (stop reason: ${response.stopReason ?? "unknown"})`,
    );
  }
}
