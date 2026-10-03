import { answerPolicyQuestion } from "./policy-assistant.js";
import type { PolicyChunk } from "./policy-search.js";

export interface PolicyEvaluationCase {
  id: string;
  question: string;
  expectedStatus: "ANSWERED" | "INSUFFICIENT_EVIDENCE";
  expectedChunkId?: string;
}

export interface PolicyEvaluationThresholds {
  statusAccuracy: number;
  retrievalHitRate: number;
  top1Accuracy: number;
  citationValidity: number;
  safeRefusalAccuracy: number;
}

export interface PolicyEvaluationResult {
  id: string;
  question: string;
  expectedStatus: PolicyEvaluationCase["expectedStatus"];
  actualStatus: PolicyEvaluationCase["expectedStatus"];
  retrievedChunkIds: string[];
  statusCorrect: boolean;
  retrievalHit: boolean | null;
  top1Correct: boolean | null;
  citationsValid: boolean;
  safeRefusalCorrect: boolean | null;
}

export interface PolicyEvaluationReport {
  passed: boolean;
  totalCases: number;
  answeredCases: number;
  refusalCases: number;
  metrics: PolicyEvaluationThresholds;
  thresholds: PolicyEvaluationThresholds;
  results: PolicyEvaluationResult[];
}

export const DEFAULT_POLICY_EVALUATION_CASES: readonly PolicyEvaluationCase[] = [
  {
    id: "dscr-threshold",
    question: "What is the minimum DSCR borrowers must maintain?",
    expectedStatus: "ANSWERED",
    expectedChunkId:
      "commercial-credit-policy:5-3-debt-service-requirements",
  },
  {
    id: "dscr-calculation",
    question: "How is debt service coverage ratio calculated?",
    expectedStatus: "ANSWERED",
    expectedChunkId:
      "commercial-credit-policy:5-3-debt-service-requirements",
  },
  {
    id: "leverage-threshold",
    question: "What is the maximum permitted leverage?",
    expectedStatus: "ANSWERED",
    expectedChunkId:
      "commercial-credit-policy:5-4-leverage-requirements",
  },
  {
    id: "liquidity-threshold",
    question: "What minimum current ratio must a borrower maintain?",
    expectedStatus: "ANSWERED",
    expectedChunkId:
      "commercial-credit-policy:5-5-liquidity-requirements",
  },
  {
    id: "approval-authority",
    question: "Who may approve credit?",
    expectedStatus: "ANSWERED",
    expectedChunkId:
      "commercial-credit-policy:6-2-human-decision-authority",
  },
  {
    id: "waiver-authority",
    question: "Can an automated system waive a covenant?",
    expectedStatus: "ANSWERED",
    expectedChunkId:
      "commercial-credit-policy:6-2-human-decision-authority",
  },
  {
    id: "unrelated-dress-code",
    question: "What is the office dress code?",
    expectedStatus: "INSUFFICIENT_EVIDENCE",
  },
  {
    id: "unrelated-remote-work",
    question: "Is remote work permitted on Fridays?",
    expectedStatus: "INSUFFICIENT_EVIDENCE",
  },
];

export const DEFAULT_POLICY_EVALUATION_THRESHOLDS: PolicyEvaluationThresholds = {
  statusAccuracy: 1,
  retrievalHitRate: 1,
  top1Accuracy: 1,
  citationValidity: 1,
  safeRefusalAccuracy: 1,
};

function ratio(passed: number, total: number): number {
  return total === 0 ? 1 : Number((passed / total).toFixed(4));
}

function validateThreshold(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be between 0 and 1`);
  }
}

function citationsMatchCorpus(
  retrievedChunkIds: readonly string[],
  evidence: ReturnType<typeof answerPolicyQuestion>["evidence"],
  chunks: readonly PolicyChunk[],
): boolean {
  if (retrievedChunkIds.length !== evidence.length) {
    return false;
  }

  return evidence.every((item) => {
    const source = chunks.find((chunk) => chunk.id === item.chunkId);

    return (
      source !== undefined &&
      item.content === source.content &&
      item.citation.document === source.documentTitle &&
      item.citation.section === source.section &&
      item.citation.version === source.version &&
      item.citation.effectiveDate === source.effectiveDate
    );
  });
}

export function evaluatePolicyAssistant(
  cases: readonly PolicyEvaluationCase[],
  chunks: readonly PolicyChunk[],
  thresholds: PolicyEvaluationThresholds =
    DEFAULT_POLICY_EVALUATION_THRESHOLDS,
): PolicyEvaluationReport {
  if (cases.length === 0) {
    throw new RangeError("at least one evaluation case is required");
  }

  for (const [name, value] of Object.entries(thresholds)) {
    validateThreshold(value, name);
  }

  const results = cases.map((evaluationCase): PolicyEvaluationResult => {
    const response = answerPolicyQuestion(evaluationCase.question, chunks);
    const retrievedChunkIds = response.evidence.map((item) => item.chunkId);
    const isAnsweredCase = evaluationCase.expectedStatus === "ANSWERED";
    const isRefusalCase =
      evaluationCase.expectedStatus === "INSUFFICIENT_EVIDENCE";

    return {
      id: evaluationCase.id,
      question: evaluationCase.question,
      expectedStatus: evaluationCase.expectedStatus,
      actualStatus: response.status,
      retrievedChunkIds,
      statusCorrect: response.status === evaluationCase.expectedStatus,
      retrievalHit: isAnsweredCase
        ? retrievedChunkIds.includes(evaluationCase.expectedChunkId ?? "")
        : null,
      top1Correct: isAnsweredCase
        ? retrievedChunkIds[0] === evaluationCase.expectedChunkId
        : null,
      citationsValid: citationsMatchCorpus(
        retrievedChunkIds,
        response.evidence,
        chunks,
      ),
      safeRefusalCorrect: isRefusalCase
        ? response.status === "INSUFFICIENT_EVIDENCE" &&
          response.grounded === false &&
          response.evidence.length === 0
        : null,
    };
  });

  const answeredResults = results.filter(
    (result) => result.expectedStatus === "ANSWERED",
  );
  const refusalResults = results.filter(
    (result) => result.expectedStatus === "INSUFFICIENT_EVIDENCE",
  );
  const metrics: PolicyEvaluationThresholds = {
    statusAccuracy: ratio(
      results.filter((result) => result.statusCorrect).length,
      results.length,
    ),
    retrievalHitRate: ratio(
      answeredResults.filter((result) => result.retrievalHit).length,
      answeredResults.length,
    ),
    top1Accuracy: ratio(
      answeredResults.filter((result) => result.top1Correct).length,
      answeredResults.length,
    ),
    citationValidity: ratio(
      results.filter((result) => result.citationsValid).length,
      results.length,
    ),
    safeRefusalAccuracy: ratio(
      refusalResults.filter((result) => result.safeRefusalCorrect).length,
      refusalResults.length,
    ),
  };
  const passed = (
    Object.keys(thresholds) as Array<keyof PolicyEvaluationThresholds>
  ).every((metric) => metrics[metric] >= thresholds[metric]);

  return {
    passed,
    totalCases: results.length,
    answeredCases: answeredResults.length,
    refusalCases: refusalResults.length,
    metrics,
    thresholds: structuredClone(thresholds),
    results,
  };
}
