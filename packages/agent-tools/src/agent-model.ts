export interface AgentToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type AgentMessage =
  | {
      role: "user";
      text: string;
    }
  | {
      role: "assistant";
      text: string;
      toolCalls: AgentToolCall[];
    }
  | {
      role: "tool";
      toolCallId: string;
      name: string;
      result: unknown;
      isError: boolean;
    };

export type AgentModelResponse =
  | {
      kind: "tool_calls";
      text: string;
      toolCalls: AgentToolCall[];
    }
  | {
      kind: "final";
      text: string;
    };

export interface AgentToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: false;
  };
}

export interface AgentModelRequest {
  systemPrompt: string;
  messages: readonly AgentMessage[];
  tools: readonly AgentToolDefinition[];
}

export interface AgentModel {
  respond(
    request: AgentModelRequest,
  ): Promise<AgentModelResponse>;
}