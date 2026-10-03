import {
  searchCreditPolicy,
  type PolicyChunk,
  type PolicySearchResult,
} from "./policy-search.js";

export interface PolicyAssistantResponse {
  status: "ANSWERED" | "INSUFFICIENT_EVIDENCE";
  mode: "EXTRACTIVE_RAG";
  question: string;
  answer: string;
  grounded: boolean;
  evidence: PolicySearchResult[];
}

export function answerPolicyQuestion(
  question: string,
  chunks: readonly PolicyChunk[],
  limit = 3,
): PolicyAssistantResponse {
  const normalizedQuestion = question.trim();

  if (normalizedQuestion.length === 0) {
    throw new TypeError("question must be a non-empty string");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 5) {
    throw new RangeError("limit must be an integer between 1 and 5");
  }

  const evidence = searchCreditPolicy(normalizedQuestion, chunks, limit);

  if (evidence.length === 0) {
    return {
      status: "INSUFFICIENT_EVIDENCE",
      mode: "EXTRACTIVE_RAG",
      question: normalizedQuestion,
      answer:
        "I could not find enough evidence in the available policy document to answer that question.",
      grounded: false,
      evidence: [],
    };
  }

  const primaryEvidence = evidence[0]!;

  return {
    status: "ANSWERED",
    mode: "EXTRACTIVE_RAG",
    question: normalizedQuestion,
    answer:
      `According to ${primaryEvidence.citation.document}, ` +
      `${primaryEvidence.citation.section}: ${primaryEvidence.content}`,
    grounded: true,
    evidence: structuredClone(evidence),
  };
}
