import { FinancialCalculationError } from "./calculations.js";

export type CovenantDirection = "minimum" | "maximum";
export type CovenantStatus = "PASS" | "BREACH";

export interface PolicyCitation {
  document: string;
  section: string;
}

export interface CovenantRule {
  id: string;
  name: string;
  metric: "DSCR" | "CURRENT_RATIO" | "DEBT_TO_EQUITY" | "LEVERAGE";
  direction: CovenantDirection;
  threshold: number;
  citation: PolicyCitation;
}

export interface CovenantResult {
  covenantId: string;
  name: string;
  actual: number;
  threshold: number;
  status: CovenantStatus;
  headroom: number;
  explanation: string;
  citation: PolicyCitation;
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

export function testCovenant(
  rule: CovenantRule,
  actual: number,
): CovenantResult {
  if (!Number.isFinite(actual)) {
    throw new FinancialCalculationError(
      `Actual ${rule.metric} value must be finite`,
    );
  }

  if (!Number.isFinite(rule.threshold) || rule.threshold < 0) {
    throw new FinancialCalculationError(
      `${rule.name} threshold must be a non-negative finite number`,
    );
  }

  const passed =
    rule.direction === "minimum"
      ? actual >= rule.threshold
      : actual <= rule.threshold;

  const headroom =
    rule.direction === "minimum"
      ? actual - rule.threshold
      : rule.threshold - actual;

  return {
    covenantId: rule.id,
    name: rule.name,
    actual,
    threshold: rule.threshold,
    status: passed ? "PASS" : "BREACH",
    headroom: round(headroom),
    explanation: passed
      ? `${rule.metric} is within the permitted threshold`
      : `${rule.metric} is outside the permitted threshold`,
    citation: rule.citation,
  };
}