import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  AuditedToolExecutor,
  answerPolicyQuestion,
  chunkPolicyDocument,
  orchestrateRelationshipReview,
} from "@creditops/agent-tools";
import { borrowers } from "@creditops/domain";

const policyCandidates = [
  resolve(process.cwd(), "docs/policies/commercial-credit-policy.md"),
  resolve(process.cwd(), "../../docs/policies/commercial-credit-policy.md"),
];

function loadPolicy(): string {
  const policyPath = policyCandidates.find(existsSync);

  if (!policyPath) {
    throw new Error("Commercial credit policy document was not found");
  }

  return readFileSync(policyPath, "utf8");
}

const policyChunks = chunkPolicyDocument(loadPolicy(), {
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

export function getRelationshipReview(borrowerId: string) {
  const executor = new AuditedToolExecutor(policyChunks);
  const review = orchestrateRelationshipReview(borrowerId, executor, {
    actorId: "portfolio-demo-banker",
    role: "BANKER",
    correlationId: `web-review-${borrowerId}`,
  });

  return {
    review,
    auditEvents: executor.getAuditEvents(),
  };
}

export function getPolicyAnswer(question: string) {
  return answerPolicyQuestion(question, policyChunks);
}
