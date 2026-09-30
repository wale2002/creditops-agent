import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { chunkPolicyDocument } from "../src/policy-search.js";
import { orchestrateRelationshipReview } from "../src/relationship-review.js";
import {
  AuditedToolExecutor,
  type ToolExecutionContext,
} from "../src/tool-executor.js";

const policyPath = new URL(
  "../../../docs/policies/commercial-credit-policy.md",
  import.meta.url,
);

const chunks = chunkPolicyDocument(
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
  correlationId: "annual-review-atlas-001",
};

function createExecutor(): AuditedToolExecutor {
  let eventNumber = 0;

  return new AuditedToolExecutor(
    chunks,
    () => new Date("2026-09-30T09:00:00.000Z"),
    () => `audit-${++eventNumber}`,
  );
}

describe("relationship review orchestration", () => {
  it("creates an evidence-backed Atlas review", () => {
    const executor = createExecutor();

    const review = orchestrateRelationshipReview(
      "atlas-manufacturing",
      executor,
      context,
    );

    assert.equal(review.status, "AWAITING_HUMAN_REVIEW");
    assert.equal(review.finalDecision, null);
    assert.equal(review.aiGenerated, true);
    assert.equal(review.exposure, 180_000_000);

    assert.ok(
      review.findings.some(
        (finding) =>
          finding.code === "COVENANT_atlas-minimum-dscr",
      ),
    );

    assert.ok(
      review.findings.some(
        (finding) => finding.code === "REVENUE_DECLINE",
      ),
    );

    assert.ok(
      review.findings.some(
        (finding) =>
          finding.code === "DOCUMENT_atlas-management-accounts",
      ),
    );

    assert.ok(
      review.policyEvidence.some(
        (evidence) =>
          evidence.citation.section ===
          "5.3 — Debt Service Requirements",
      ),
    );

    assert.ok(
      review.policyEvidence.some(
        (evidence) =>
          evidence.citation.section ===
          "6.2 — Human Decision Authority",
      ),
    );
  });

  it("records the complete tool sequence", () => {
    const executor = createExecutor();

    orchestrateRelationshipReview(
      "atlas-manufacturing",
      executor,
      context,
    );

    const events = executor.getAuditEvents();

    assert.equal(events.length, 8);
    assert.ok(
      events.every((event) => event.outcome === "SUCCESS"),
    );

    assert.deepEqual(
      events.map((event) => event.toolName),
      [
        "getBorrowerProfile",
        "getFacilities",
        "getFinancialStatements",
        "calculateFinancialRatios",
        "testCovenants",
        "identifyMissingDocuments",
        "searchCreditPolicy",
        "searchCreditPolicy",
      ],
    );
  });
});