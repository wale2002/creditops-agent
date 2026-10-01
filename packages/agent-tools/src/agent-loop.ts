import {
  CREDIT_AGENT_TOOLS,
  isAgentToolName,
} from "./agent-tool-definitions.js";
import type { AgentMessage, AgentModel } from "./agent-model.js";
import {
  AuditedToolExecutor,
  type AuditEvent,
  type ToolExecutionContext,
} from "./tool-executor.js";

export const CREDIT_ANALYST_SYSTEM_PROMPT = `
You are CreditOps, an assistant for commercial-credit analysts.

You may retrieve synthetic borrower information, run deterministic financial
calculations, test covenants, identify missing documents, and retrieve fictional
credit-policy evidence.

Rules:
- Never perform financial arithmetic yourself when an available tool can do it.
- Never invent borrower data, covenant thresholds, policies, or citations.
- Treat an empty policy-search result as insufficient evidence.
- Cite the policy document and section supporting every policy statement.
- Never approve credit, waive a covenant, amend a facility, or make a final
  lending decision.
- Prepare drafts for review by an authorized human credit officer.
`.trim();

export interface RunCreditAgentOptions {
  model: AgentModel;
  executor: AuditedToolExecutor;
  context: ToolExecutionContext;
  userRequest: string;
  maxModelTurns?: number;
}

export interface CreditAgentRunResult {
  finalText: string;
  modelTurns: number;
  messages: AgentMessage[];
  auditEvents: AuditEvent[];
}

export class AgentProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentProtocolError";
  }
}

export class AgentLoopLimitError extends Error {
  constructor(maxModelTurns: number) {
    super(
      `Agent did not produce a final response within ${maxModelTurns} model turns`,
    );
    this.name = "AgentLoopLimitError";
  }
}

function errorResult(error: unknown): {
  error: string;
  errorType: string;
} {
  if (error instanceof Error) {
    return {
      error: error.message,
      errorType: error.name,
    };
  }

  return {
    error: "Unknown tool execution error",
    errorType: "UnknownError",
  };
}

export async function runCreditAgent(
  options: RunCreditAgentOptions,
): Promise<CreditAgentRunResult> {
  const maxModelTurns = options.maxModelTurns ?? 8;

  if (
    !Number.isInteger(maxModelTurns) ||
    maxModelTurns < 1 ||
    maxModelTurns > 20
  ) {
    throw new RangeError("maxModelTurns must be an integer between 1 and 20");
  }

  if (options.userRequest.trim().length === 0) {
    throw new AgentProtocolError("userRequest must be a non-empty string");
  }

  const messages: AgentMessage[] = [
    {
      role: "user",
      text: options.userRequest,
    },
  ];

  const seenToolCallIds = new Set<string>();

  for (let turn = 1; turn <= maxModelTurns; turn += 1) {
    const response = await options.model.respond({
      systemPrompt: CREDIT_ANALYST_SYSTEM_PROMPT,
      messages: structuredClone(messages),
      tools: structuredClone(CREDIT_AGENT_TOOLS),
    });

    if (response.kind === "final") {
      if (response.text.trim().length === 0) {
        throw new AgentProtocolError("Model returned an empty final response");
      }

      return {
        finalText: response.text,
        modelTurns: turn,
        messages: structuredClone(messages),
        auditEvents: options.executor.getAuditEvents(),
      };
    }

    if (response.toolCalls.length === 0) {
      throw new AgentProtocolError(
        "Model requested a tool turn without any tool calls",
      );
    }

    if (response.toolCalls.length > 8) {
      throw new AgentProtocolError(
        "Model requested more than eight tools in one turn",
      );
    }

    messages.push({
      role: "assistant",
      text: response.text,
      toolCalls: structuredClone(response.toolCalls),
    });

    for (const toolCall of response.toolCalls) {
      if (toolCall.id.trim().length === 0 || seenToolCallIds.has(toolCall.id)) {
        throw new AgentProtocolError(
          `Invalid or duplicate tool-call ID: ${toolCall.id}`,
        );
      }

      seenToolCallIds.add(toolCall.id);

      if (!isAgentToolName(toolCall.name)) {
        throw new AgentProtocolError(
          `Model requested an unsupported tool: ${toolCall.name}`,
        );
      }

      try {
        const result = options.executor.execute(
          toolCall.name,
          toolCall.input,
          options.context,
        );

        messages.push({
          role: "tool",
          toolCallId: toolCall.id,
          name: toolCall.name,
          result,
          isError: false,
        });
      } catch (error) {
        messages.push({
          role: "tool",
          toolCallId: toolCall.id,
          name: toolCall.name,
          result: errorResult(error),
          isError: true,
        });
      }
    }
  }

  throw new AgentLoopLimitError(maxModelTurns);
}
