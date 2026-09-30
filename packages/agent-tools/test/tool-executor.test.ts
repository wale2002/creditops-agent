import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { chunkPolicyDocument } from "../src/policy-search.js";
import {
  AuditedToolExecutor,
  ToolPermissionError,
  type ToolExecutionContext,
} from "../src/tool-executor.js";

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

const bankerContext: ToolExecutionContext = {
  actorId: "banker-001",
  role: "BANKER",
  correlationId: "review-atlas-001",
};

function createExecutor(): AuditedToolExecutor {
  let eventNumber = 0;

  return new AuditedToolExecutor(
    policyChunks,
    () => new Date("2026-09-30T09:00:00.000Z"),
    () => `audit-${++eventNumber}`,
  );
}

describe("audited tool executor", () => {
  it("executes an authorized tool and records success", () => {
    const executor = createExecutor();

    const result = executor.execute(
      "calculateFinancialRatios",
      { borrowerId: "atlas-manufacturing" },
      bankerContext,
    ) as { dscr: number };

    assert.equal(result.dscr, 1.18);

    const events = executor.getAuditEvents();

    assert.equal(events.length, 1);
    assert.equal(events[0]?.toolName, "calculateFinancialRatios");
    assert.equal(events[0]?.outcome, "SUCCESS");
    assert.equal(events[0]?.correlationId, "review-atlas-001");
  });

  it("denies a system monitor access to the full profile", () => {
    const executor = createExecutor();

    assert.throws(
      () =>
        executor.execute(
          "getBorrowerProfile",
          { borrowerId: "atlas-manufacturing" },
          {
            actorId: "monitor-001",
            role: "SYSTEM_MONITOR",
            correlationId: "monitoring-run-001",
          },
        ),
      ToolPermissionError,
    );

    const events = executor.getAuditEvents();

    assert.equal(events[0]?.outcome, "DENIED");
  });

  it("records invalid tool input as an error", () => {
    const executor = createExecutor();

    assert.throws(() =>
      executor.execute(
        "searchCreditPolicy",
        { query: "" },
        bankerContext,
      ),
    );

    const events = executor.getAuditEvents();

    assert.equal(events[0]?.outcome, "ERROR");
    assert.match(events[0]?.error ?? "", /non-empty string/);
  });

  it("returns cloned audit events", () => {
    const executor = createExecutor();

    executor.execute(
      "testCovenants",
      { borrowerId: "atlas-manufacturing" },
      bankerContext,
    );

    const firstRead = executor.getAuditEvents();
    firstRead[0]!.actorId = "changed-by-caller";

    const secondRead = executor.getAuditEvents();

    assert.equal(secondRead[0]?.actorId, "banker-001");
  });
});