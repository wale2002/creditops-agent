import type { AgentToolDefinition } from "./agent-model.js";
import type { AgentToolName } from "./tool-executor.js";

function borrowerTool(
  name: AgentToolName,
  description: string,
): AgentToolDefinition {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      properties: {
        borrowerId: {
          type: "string",
          minLength: 1,
          description: "The exact ID of the borrower to inspect",
        },
      },
      required: ["borrowerId"],
      additionalProperties: false,
    },
  };
}

export const CREDIT_AGENT_TOOLS: readonly AgentToolDefinition[] = [
  borrowerTool(
    "getBorrowerProfile",
    "Retrieve a synthetic borrower's profile and source records.",
  ),
  borrowerTool(
    "getFacilities",
    "Retrieve the borrower's credit facilities and outstanding balances.",
  ),
  borrowerTool(
    "getFinancialStatements",
    "Retrieve the borrower's recorded financial statements.",
  ),
  borrowerTool(
    "calculateFinancialRatios",
    "Calculate DSCR, current ratio, debt to equity, leverage, exposure, and revenue change using deterministic code.",
  ),
  borrowerTool(
    "testCovenants",
    "Evaluate the borrower's recorded covenant thresholds using deterministic code.",
  ),
  borrowerTool(
    "identifyMissingDocuments",
    "Identify borrower documents recorded as missing or overdue.",
  ),
  {
    name: "searchCreditPolicy",
    description:
      "Retrieve relevant fictional credit-policy sections with citations. An empty result means no supporting evidence was found.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          minLength: 1,
          description: "The policy question to search",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          description: "Maximum number of policy sections to return",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
];

export function isAgentToolName(value: string): value is AgentToolName {
  return CREDIT_AGENT_TOOLS.some((tool) => tool.name === value);
}
