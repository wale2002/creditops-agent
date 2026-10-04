import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  FileReviewDecisionStore,
  ReviewApprovalService,
  AuditedToolExecutor,
  DEFAULT_POLICY_EVALUATION_CASES,
  answerPolicyQuestion,
  chunkPolicyDocument,
  createReviewDigest,
  evaluatePolicyAssistant,
  orchestrateRelationshipReview,
  type HumanDecision,
} from "@creditops/agent-tools";
import { borrowers } from "@creditops/domain";

const policyCandidates = [
  resolve(process.cwd(), "docs/policies/commercial-credit-policy.md"),
  resolve(process.cwd(), "../../docs/policies/commercial-credit-policy.md"),
];

const policyPath = policyCandidates.find(existsSync);

if (!policyPath) {
  throw new Error("Commercial credit policy document was not found");
}

const repositoryRoot = resolve(dirname(policyPath), "../..");

const configuredDecisionLog =
  process.env.CREDITOPS_DECISION_LOG_PATH?.trim();
const decisionStore = new FileReviewDecisionStore(
  configuredDecisionLog
    ? resolve(repositoryRoot, configuredDecisionLog)
    : resolve(repositoryRoot, ".creditops-data/review-decisions.jsonl"),
);
const approvalService = new ReviewApprovalService(decisionStore);

export class DemoApprovalDisabledError extends Error {
  constructor() {
    super(
      "Local demo approvals are disabled in production. Connect an authenticated identity provider or explicitly enable the demo adapter.",
    );
    this.name = "DemoApprovalDisabledError";
  }
}

function loadPolicy(path: string): string {
  return readFileSync(path, "utf8");
}

const policyChunks = chunkPolicyDocument(loadPolicy(policyPath), {
  documentId: "commercial-credit-policy",
  title: "Commercial Credit Policy",
  version: "1.0",
  effectiveDate: "2026-01-01",
});

export const borrowerOptions = borrowers.map((borrower) => ({
  id: borrower.id,
  name: borrower.name,
  sector: borrower.sector,
  riskStatus: borrower.riskStatus,
}));

export function getLocalReviewerIdentity() {
  return {
    actorId:
      process.env.CREDITOPS_DEMO_REVIEWER_ID?.trim() ||
      "local-demo-credit-officer",
    role: "CREDIT_OFFICER" as const,
    source: "LOCAL_DEMO" as const,
    enabled:
      process.env.NODE_ENV !== "production" ||
      process.env.CREDITOPS_ALLOW_DEMO_APPROVALS === "true",
  };
}

function buildRelationshipReview(borrowerId: string) {
  const exists = borrowerOptions.some((borrower) => borrower.id === borrowerId);

  if (!exists) {
    throw new Error(`Unknown borrower: ${borrowerId}`);
  }

  const executor = new AuditedToolExecutor(policyChunks);
  const review = orchestrateRelationshipReview(borrowerId, executor, {
    actorId: "portfolio-demo-banker",
    role: "BANKER",
    correlationId: `web-review-${borrowerId}`,
  });

  return {
    review,
    auditEvents: executor.getAuditEvents(),
    reviewDigest: createReviewDigest(review),
  };
}

export function getRelationshipReview(borrowerId: string) {
  const { review, auditEvents, reviewDigest } =
    buildRelationshipReview(borrowerId);

  return {
    review,
    auditEvents,
    approval: approvalService.getState(borrowerId, reviewDigest),
  };
}

export function submitRelationshipDecision(input: {
  borrowerId: string;
  decision: HumanDecision;
  rationale: string;
  expectedVersion: number;
}) {
  const reviewer = getLocalReviewerIdentity();

  if (!reviewer.enabled) {
    throw new DemoApprovalDisabledError();
  }

  const { reviewDigest } = buildRelationshipReview(input.borrowerId);

  return approvalService.submitDecision({
    borrowerId: input.borrowerId,
    reviewDigest,
    decision: input.decision,
    rationale: input.rationale,
    actorId: reviewer.actorId,
    actorRole: reviewer.role,
    expectedVersion: input.expectedVersion,
  });
}

export function getPolicyAnswer(question: string) {
  return answerPolicyQuestion(question, policyChunks);
}

export function getPolicyEvaluation() {
  return evaluatePolicyAssistant(
    DEFAULT_POLICY_EVALUATION_CASES,
    policyChunks,
  );
}
