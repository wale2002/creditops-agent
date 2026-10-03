import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  chunkPolicyDocument,
  searchCreditPolicy,
} from "../src/policy-search.js";

const policyPath = new URL(
  "../../../docs/policies/commercial-credit-policy.md",
  import.meta.url,
);

const markdown = readFileSync(policyPath, "utf8");

const chunks = chunkPolicyDocument(markdown, {
  documentId: "commercial-credit-policy",
  title: "Commercial Credit Policy",
  version: "1.0",
  effectiveDate: "2026-01-01",
});

describe("policy ingestion and retrieval", () => {
  it("creates one chunk for every policy section", () => {
    assert.equal(chunks.length, 4);
    assert.equal(chunks[0]?.section, "5.3 — Debt Service Requirements");
  });

  it("retrieves the DSCR requirement with a citation", () => {
    const results = searchCreditPolicy(
      "What is the minimum DSCR requirement?",
      chunks,
    );

    assert.equal(
      results[0]?.citation.section,
      "5.3 — Debt Service Requirements",
    );
    assert.equal(
      results[0]?.citation.document,
      "Commercial Credit Policy",
    );
    assert.match(results[0]?.content ?? "", /1\.25x/);
  });

  it("retrieves the human-approval restriction", () => {
    const results = searchCreditPolicy(
      "Who may approve credit or waive a covenant?",
      chunks,
    );

    assert.equal(
      results[0]?.citation.section,
      "6.2 — Human Decision Authority",
    );
  });

  it("ranks an exact liquidity phrase above generic policy language", () => {
    const results = searchCreditPolicy(
      "What minimum current ratio must a borrower maintain?",
      chunks,
    );

    assert.equal(
      results[0]?.citation.section,
      "5.5 — Liquidity Requirements",
    );
  });

  it("returns no evidence for an unrelated question", () => {
    const results = searchCreditPolicy(
      "What is tomorrow's weather forecast?",
      chunks,
    );

    assert.deepEqual(results, []);
  });
});
