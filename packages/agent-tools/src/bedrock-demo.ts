import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

import { runCreditAgent } from "./agent-loop.js";
import { BedrockAgentModel } from "./bedrock-agent-model.js";
import { chunkPolicyDocument } from "./policy-search.js";
import { AuditedToolExecutor } from "./tool-executor.js";

export interface BedrockDemoConfig {
  live: boolean;
  help: boolean;
  borrowerId: string;
  region?: string;
  modelId?: string;
}

export class BedrockDemoConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BedrockDemoConfigError";
  }
}

function optionalNonEmpty(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function parseBedrockDemoConfig(
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
): BedrockDemoConfig {
  const allowedFlags = new Set(["--live", "--help", "-h"]);
  const unknownFlag = args.find(
    (argument) =>
      argument.startsWith("--") &&
      !allowedFlags.has(argument) &&
      !argument.startsWith("--borrower="),
  );

  if (unknownFlag) {
    throw new BedrockDemoConfigError(
      `Unknown command-line option: ${unknownFlag}`,
    );
  }

  const borrowerArgument = args.find((argument) =>
    argument.startsWith("--borrower="),
  );
  const borrowerId = optionalNonEmpty(
    borrowerArgument?.slice("--borrower=".length) ??
      environment.CREDITOPS_BORROWER_ID,
  ) ?? "atlas-manufacturing";
  const region = optionalNonEmpty(environment.AWS_REGION);
  const modelId = optionalNonEmpty(environment.BEDROCK_MODEL_ID);

  return {
    live: args.includes("--live"),
    help: args.includes("--help") || args.includes("-h"),
    borrowerId,
    ...(region ? { region } : {}),
    ...(modelId ? { modelId } : {}),
  };
}

export function validateLiveBedrockConfig(
  config: BedrockDemoConfig,
): asserts config is BedrockDemoConfig & {
  region: string;
  modelId: string;
} {
  if (!config.region) {
    throw new BedrockDemoConfigError(
      "AWS_REGION is required for a live Bedrock run",
    );
  }

  if (!config.modelId) {
    throw new BedrockDemoConfigError(
      "BEDROCK_MODEL_ID is required for a live Bedrock run",
    );
  }
}

function printHelp(): void {
  console.log(`CreditOps Bedrock demo

Usage:
  npm run demo:bedrock --workspace @creditops/agent-tools
  npm run demo:bedrock --workspace @creditops/agent-tools -- --live

Options:
  --live                 Explicitly allow calls to Amazon Bedrock
  --borrower=<id>        Borrower to review (default: atlas-manufacturing)
  --help, -h             Show this help

Environment:
  AWS_REGION             AWS Region used for Bedrock
  BEDROCK_MODEL_ID       Enabled model or inference-profile ID
  CREDITOPS_BORROWER_ID  Optional default borrower ID`);
}

function loadLocalEnvironment(): void {
  const environmentPath = resolve(process.cwd(), ".env");

  if (existsSync(environmentPath)) {
    loadEnvFile(environmentPath);
  }
}

function printPreflight(config: BedrockDemoConfig): void {
  console.log("CreditOps Bedrock preflight");
  console.log("---------------------------");
  console.log("Mode: DRY RUN (no AWS request sent)");
  console.log(`Borrower: ${config.borrowerId}`);
  console.log(`AWS_REGION: ${config.region ?? "NOT SET"}`);
  console.log(`BEDROCK_MODEL_ID: ${config.modelId ?? "NOT SET"}`);
  console.log("");
  console.log("To make an intentional live request, configure .env and add --live.");
}

async function runLiveDemo(
  config: BedrockDemoConfig,
): Promise<void> {
  validateLiveBedrockConfig(config);

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
  const executor = new AuditedToolExecutor(policyChunks);
  const model = new BedrockAgentModel({
    region: config.region,
    modelId: config.modelId,
    temperature: 0,
    maxTokens: 1_500,
  });

  console.log(
    `Starting live Bedrock review for ${config.borrowerId} in ${config.region}...`,
  );

  const result = await runCreditAgent({
    model,
    executor,
    context: {
      actorId: "local-demo-banker",
      role: "BANKER",
      correlationId: randomUUID(),
    },
    userRequest: [
      `Prepare a relationship review for borrower ${config.borrowerId}.`,
      "Use tools for borrower data, calculations, covenants, documents, and policy evidence.",
      "Clearly state that the output is a draft requiring human credit-officer review.",
    ].join(" "),
  });

  console.log("\nAgent response\n--------------");
  console.log(result.finalText);
  console.log("\nAudit summary\n-------------");
  console.table(
    result.auditEvents.map((event) => ({
      tool: event.toolName,
      outcome: event.outcome,
      occurredAt: event.occurredAt,
    })),
  );
}

export async function main(): Promise<void> {
  loadLocalEnvironment();
  const config = parseBedrockDemoConfig(
    process.argv.slice(2),
    process.env,
  );

  if (config.help) {
    printHelp();
    return;
  }

  if (!config.live) {
    printPreflight(config);
    return;
  }

  await runLiveDemo(config);
}

const entryPoint = process.argv[1];

if (
  entryPoint &&
  resolve(entryPoint) === resolve(fileURLToPath(import.meta.url))
) {
  main().catch((error: unknown) => {
    const name = error instanceof Error ? error.name : "UnknownError";
    const message =
      error instanceof Error ? error.message : "Unknown Bedrock demo error";

    console.error(`\n${name}: ${message}`);
    process.exitCode = 1;
  });
}
