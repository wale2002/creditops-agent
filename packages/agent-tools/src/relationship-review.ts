import type {
  Borrower,
  BorrowerDocument,
  CovenantResult,
  CreditFacility,
  FinancialStatement,
} from "@creditops/domain";

import type { FinancialRatioSnapshot } from "./credit-tools.js";
import type { PolicySearchResult } from "./policy-search.js";
import {
  AuditedToolExecutor,
  type ToolExecutionContext,
} from "./tool-executor.js";

export interface ReviewFinding {
  code: string;
  severity: "INFO" | "MODERATE" | "HIGH";
  title: string;
  detail: string;
  citation?: {
    document: string;
    section: string;
  };
}

export interface DraftRelationshipReview {
  borrowerId: string;
  borrowerName: string;
  status: "AWAITING_HUMAN_REVIEW";
  aiGenerated: true;
  finalDecision: null;
  exposure: number;
  facilityCount: number;
  financialStatementCount: number;
  ratios: FinancialRatioSnapshot;
  covenantResults: CovenantResult[];
  missingDocuments: BorrowerDocument[];
  findings: ReviewFinding[];
  policyEvidence: PolicySearchResult[];
}

function uniqueEvidence(
  evidence: PolicySearchResult[],
): PolicySearchResult[] {
  return evidence.filter(
    (item, index, allItems) =>
      allItems.findIndex(
        (candidate) => candidate.chunkId === item.chunkId,
      ) === index,
  );
}

export function orchestrateRelationshipReview(
  borrowerId: string,
  executor: AuditedToolExecutor,
  context: ToolExecutionContext,
): DraftRelationshipReview {
  const borrower = executor.execute(
    "getBorrowerProfile",
    { borrowerId },
    context,
  ) as Borrower;

  const facilities = executor.execute(
    "getFacilities",
    { borrowerId },
    context,
  ) as CreditFacility[];

  const financialStatements = executor.execute(
    "getFinancialStatements",
    { borrowerId },
    context,
  ) as FinancialStatement[];

  const ratios = executor.execute(
    "calculateFinancialRatios",
    { borrowerId },
    context,
  ) as FinancialRatioSnapshot;

  const covenantResults = executor.execute(
    "testCovenants",
    { borrowerId },
    context,
  ) as CovenantResult[];

  const missingDocuments = executor.execute(
    "identifyMissingDocuments",
    { borrowerId },
    context,
  ) as BorrowerDocument[];

  const breaches = covenantResults.filter(
    (result) => result.status === "BREACH",
  );

  const policyEvidence: PolicySearchResult[] = [];

  for (const breach of breaches) {
    const evidence = executor.execute(
      "searchCreditPolicy",
      {
        query: `${breach.name} ${breach.citation.section}`,
        limit: 2,
      },
      context,
    ) as PolicySearchResult[];

    policyEvidence.push(...evidence);
  }

  const authorityEvidence = executor.execute(
    "searchCreditPolicy",
    {
      query: "Who may approve credit or waive a covenant?",
      limit: 1,
    },
    context,
  ) as PolicySearchResult[];

  policyEvidence.push(...authorityEvidence);

  const findings: ReviewFinding[] = breaches.map((breach) => ({
    code: `COVENANT_${breach.covenantId}`,
    severity: "HIGH",
    title: `${breach.name} breached`,
    detail:
      `Actual ${breach.actual}x against a required ` +
      `${breach.threshold}x threshold.`,
    citation: {
      document: breach.citation.document,
      section: breach.citation.section,
    },
  }));

  if (ratios.revenueChangePercentage <= -10) {
    findings.push({
      code: "REVENUE_DECLINE",
      severity: "MODERATE",
      title: "Material revenue decline",
      detail:
        `Revenue declined by ` +
        `${Math.abs(ratios.revenueChangePercentage)}% ` +
        `from the previous reporting period.`,
    });
  }

  for (const document of missingDocuments) {
    findings.push({
      code: `DOCUMENT_${document.id}`,
      severity: "MODERATE",
      title: `${document.name} ${document.status.toLowerCase()}`,
      detail:
        document.dueDate === undefined
          ? `${document.name} is required before review completion.`
          : `${document.name} was due on ${document.dueDate}.`,
    });
  }

  if (findings.length === 0) {
    findings.push({
      code: "NO_CURRENT_EXCEPTIONS",
      severity: "INFO",
      title: "No current exceptions identified",
      detail:
        "Deterministic covenant and document checks found no exceptions.",
    });
  }

  return {
    borrowerId,
    borrowerName: borrower.name,
    status: "AWAITING_HUMAN_REVIEW",
    aiGenerated: true,
    finalDecision: null,
    exposure: ratios.exposure,
    facilityCount: facilities.length,
    financialStatementCount: financialStatements.length,
    ratios,
    covenantResults,
    missingDocuments,
    findings,
    policyEvidence: uniqueEvidence(policyEvidence),
  };
}