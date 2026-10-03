import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  answerPolicyQuestion,
  chunkPolicyDocument,
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

describe("policy assistant", () => {
  it("answers a policy question using retrieved evidence", () => {
    const response = answerPolicyQuestion(
      "What is the minimum DSCR requirement?",
      chunks,
    );

    assert.equal(response.status, "ANSWERED");
    assert.equal(response.grounded, true);
    assert.match(response.answer, /1\.25x/);
    assert.equal(
      response.evidence[0]?.citation.document,
      "Commercial Credit Policy",
    );
    assert.match(
      response.evidence[0]?.citation.section ?? "",
      /Debt Service Requirements/,
    );
  });

  it("fails safely when the policy corpus has no evidence", () => {
    const response = answerPolicyQuestion(
      "What is the office dress code?",
      chunks,
    );

    assert.equal(response.status, "INSUFFICIENT_EVIDENCE");
    assert.equal(response.grounded, false);
    assert.deepEqual(response.evidence, []);
    assert.match(response.answer, /could not find enough evidence/i);
  });

  it("rejects an empty question", () => {
    assert.throws(
      () => answerPolicyQuestion("   ", chunks),
      /question must be a non-empty string/,
    );
  });
});
