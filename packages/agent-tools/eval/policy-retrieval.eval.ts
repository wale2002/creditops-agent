import { readFileSync } from "node:fs";

import {
  DEFAULT_POLICY_EVALUATION_CASES,
  chunkPolicyDocument,
  evaluatePolicyAssistant,
} from "../src/index.js";

const policyPath = new URL(
  "../../../docs/policies/commercial-credit-policy.md",
  import.meta.url,
);
const chunks = chunkPolicyDocument(readFileSync(policyPath, "utf8"), {
  documentId: "commercial-credit-policy",
  title: "Commercial Credit Policy",
  version: "1.0",
  effectiveDate: "2026-01-01",
});
const report = evaluatePolicyAssistant(
  DEFAULT_POLICY_EVALUATION_CASES,
  chunks,
);

console.log("CreditOps policy RAG evaluation");
console.log("--------------------------------");
console.table(
  report.results.map((result) => ({
    case: result.id,
    status: result.statusCorrect ? "PASS" : "FAIL",
    retrieval: result.retrievalHit === null
      ? "N/A"
      : result.retrievalHit
        ? "PASS"
        : "FAIL",
    top1: result.top1Correct === null
      ? "N/A"
      : result.top1Correct
        ? "PASS"
        : "FAIL",
    citations: result.citationsValid ? "PASS" : "FAIL",
    refusal: result.safeRefusalCorrect === null
      ? "N/A"
      : result.safeRefusalCorrect
        ? "PASS"
        : "FAIL",
  })),
);
console.table(
  Object.fromEntries(
    Object.entries(report.metrics).map(([metric, value]) => [
      metric,
      `${(value * 100).toFixed(0)}%`,
    ]),
  ),
);
console.log(
  `Evaluation gate: ${report.passed ? "PASS" : "FAIL"} ` +
    `(${report.totalCases} cases)`,
);

if (!report.passed) {
  process.exitCode = 1;
}
