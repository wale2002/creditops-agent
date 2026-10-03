import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

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

describe("policy assistant evaluation", () => {
  it("passes the labelled retrieval and refusal benchmark", () => {
    const report = evaluatePolicyAssistant(
      DEFAULT_POLICY_EVALUATION_CASES,
      chunks,
    );

    assert.equal(report.passed, true);
    assert.equal(report.totalCases, 8);
    assert.equal(report.answeredCases, 6);
    assert.equal(report.refusalCases, 2);
    assert.deepEqual(report.metrics, {
      statusAccuracy: 1,
      retrievalHitRate: 1,
      top1Accuracy: 1,
      citationValidity: 1,
      safeRefusalAccuracy: 1,
    });
  });

  it("fails when the expected evidence label is incorrect", () => {
    const report = evaluatePolicyAssistant(
      [
        {
          id: "wrong-label",
          question: "What is the minimum DSCR?",
          expectedStatus: "ANSWERED",
          expectedChunkId: "commercial-credit-policy:not-a-real-section",
        },
      ],
      chunks,
    );

    assert.equal(report.passed, false);
    assert.equal(report.metrics.statusAccuracy, 1);
    assert.equal(report.metrics.retrievalHitRate, 0);
    assert.equal(report.metrics.top1Accuracy, 0);
    assert.equal(report.metrics.citationValidity, 1);
  });

  it("rejects invalid evaluation thresholds", () => {
    assert.throws(
      () =>
        evaluatePolicyAssistant(DEFAULT_POLICY_EVALUATION_CASES, chunks, {
          statusAccuracy: 1.1,
          retrievalHitRate: 1,
          top1Accuracy: 1,
          citationValidity: 1,
          safeRefusalAccuracy: 1,
        }),
      /statusAccuracy must be between 0 and 1/,
    );
  });
});
