import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  ApprovalPermissionError,
  DecisionConflictError,
  DecisionLogIntegrityError,
  FileReviewDecisionStore,
  InMemoryReviewDecisionStore,
  ReviewApprovalService,
} from "../src/approval-workflow.js";

const clock = () => new Date("2026-10-04T09:30:00.000Z");

function createService(store = new InMemoryReviewDecisionStore()) {
  let eventNumber = 0;
  return new ReviewApprovalService(
    store,
    clock,
    () => `decision-event-${++eventNumber}`,
  );
}

describe("human approval workflow", () => {
  it("starts with an undecided review", () => {
    const state = createService().getState("atlas-manufacturing", "digest-v1");

    assert.equal(state.status, "AWAITING_HUMAN_REVIEW");
    assert.equal(state.version, 0);
    assert.equal(state.finalDecision, null);
  });

  it("allows a credit officer to approve with a rationale", () => {
    const service = createService();
    const state = service.submitDecision({
      borrowerId: "atlas-manufacturing",
      reviewDigest: "digest-v1",
      decision: "APPROVED",
      rationale: "Approved with monthly covenant monitoring.",
      actorId: "officer-17",
      actorRole: "CREDIT_OFFICER",
      expectedVersion: 0,
    });

    assert.equal(state.status, "APPROVED");
    assert.equal(state.version, 1);
    assert.equal(state.finalDecision?.actorId, "officer-17");
    assert.equal(state.finalDecision?.previousHash, null);
    assert.match(state.finalDecision?.hash ?? "", /^[a-f0-9]{64}$/u);
  });

  it("prevents an AI agent from making a final decision", () => {
    const service = createService();

    assert.throws(
      () =>
        service.submitDecision({
          borrowerId: "atlas-manufacturing",
          reviewDigest: "digest-v1",
          decision: "REJECTED",
          rationale: "The covenant breach requires human escalation.",
          actorId: "credit-agent",
          actorRole: "AI_AGENT",
          expectedVersion: 0,
        }),
      ApprovalPermissionError,
    );
  });

  it("rejects stale concurrent submissions", () => {
    const service = createService();
    service.submitDecision({
      borrowerId: "atlas-manufacturing",
      reviewDigest: "digest-v1",
      decision: "APPROVED",
      rationale: "Approved after documented officer review.",
      actorId: "officer-17",
      actorRole: "CREDIT_OFFICER",
      expectedVersion: 0,
    });

    assert.throws(
      () =>
        service.submitDecision({
          borrowerId: "atlas-manufacturing",
          reviewDigest: "digest-v2",
          decision: "REJECTED",
          rationale: "A newer review should be loaded before deciding.",
          actorId: "officer-22",
          actorRole: "CREDIT_OFFICER",
          expectedVersion: 0,
        }),
      DecisionConflictError,
    );
  });

  it("does not allow a final decision to be overwritten", () => {
    const service = createService();
    service.submitDecision({
      borrowerId: "atlas-manufacturing",
      reviewDigest: "digest-v1",
      decision: "REJECTED",
      rationale: "Rejected pending remediation of the DSCR breach.",
      actorId: "officer-17",
      actorRole: "CREDIT_OFFICER",
      expectedVersion: 0,
    });

    assert.throws(
      () =>
        service.submitDecision({
          borrowerId: "atlas-manufacturing",
          reviewDigest: "digest-v1",
          decision: "APPROVED",
          rationale: "Attempting to replace the recorded decision.",
          actorId: "officer-17",
          actorRole: "CREDIT_OFFICER",
          expectedVersion: 1,
        }),
      DecisionConflictError,
    );
  });

  it("allows a new decision when the underlying review changes", () => {
    const service = createService();
    service.submitDecision({
      borrowerId: "atlas-manufacturing",
      reviewDigest: "digest-v1",
      decision: "REJECTED",
      rationale: "Rejected pending updated financial information.",
      actorId: "officer-17",
      actorRole: "CREDIT_OFFICER",
      expectedVersion: 0,
    });

    const refreshed = service.getState("atlas-manufacturing", "digest-v2");
    assert.equal(refreshed.status, "AWAITING_HUMAN_REVIEW");
    assert.equal(refreshed.version, 1);

    const decided = service.submitDecision({
      borrowerId: "atlas-manufacturing",
      reviewDigest: "digest-v2",
      decision: "APPROVED",
      rationale: "Updated evidence resolves the prior exception.",
      actorId: "officer-17",
      actorRole: "CREDIT_OFFICER",
      expectedVersion: 1,
    });

    assert.equal(decided.status, "APPROVED");
    assert.equal(decided.version, 2);
    assert.ok(decided.finalDecision?.previousHash);
  });

  it("persists decisions and detects a modified audit event", () => {
    const directory = mkdtempSync(join(tmpdir(), "creditops-approval-"));
    const filePath = join(directory, "decisions.jsonl");

    try {
      const store = new FileReviewDecisionStore(filePath);
      createService(store).submitDecision({
        borrowerId: "atlas-manufacturing",
        reviewDigest: "digest-v1",
        decision: "APPROVED",
        rationale: "Approved by the assigned credit officer.",
        actorId: "officer-17",
        actorRole: "CREDIT_OFFICER",
        expectedVersion: 0,
      });

      const reloaded = createService(new FileReviewDecisionStore(filePath));
      assert.equal(
        reloaded.getState("atlas-manufacturing", "digest-v1").status,
        "APPROVED",
      );

      const modified = readFileSync(filePath, "utf8").replace(
        "Approved by the assigned credit officer.",
        "Modified without authorization.",
      );
      writeFileSync(filePath, modified, "utf8");

      assert.throws(
        () => new FileReviewDecisionStore(filePath).readAll(),
        DecisionLogIntegrityError,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
