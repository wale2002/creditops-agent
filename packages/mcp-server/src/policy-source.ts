import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  chunkPolicyDocument,
  type PolicyChunk,
} from "@creditops/agent-tools";

const POLICY_RELATIVE_PATH = "docs/policies/commercial-credit-policy.md";

export function resolveDefaultPolicyPath(): string {
  const candidates = [
    resolve(process.cwd(), POLICY_RELATIVE_PATH),
    resolve(process.cwd(), "../../", POLICY_RELATIVE_PATH),
    fileURLToPath(
      new URL(
        "../../../docs/policies/commercial-credit-policy.md",
        import.meta.url,
      ),
    ),
  ];

  const policyPath = candidates.find(existsSync);

  if (!policyPath) {
    throw new Error(
      `Credit policy was not found. Expected ${POLICY_RELATIVE_PATH}`,
    );
  }

  return policyPath;
}

export function loadDefaultPolicyChunks(): PolicyChunk[] {
  return chunkPolicyDocument(
    readFileSync(resolveDefaultPolicyPath(), "utf8"),
    {
      documentId: "commercial-credit-policy",
      title: "Commercial Credit Policy",
      version: "1.0",
      effectiveDate: "2026-01-01",
    },
  );
}
