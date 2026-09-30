import {
  calculateCurrentRatio,
  calculateDebtToEquity,
  calculateDSCR,
  calculateLeverageRatio,
  getBorrowerById,
  testCovenant,
  type Borrower,
  type BorrowerDocument,
  type CovenantResult,
  type CreditFacility,
  type FinancialStatement,
} from "@creditops/domain";

export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolInputError";
  }
}

export interface FinancialRatioSnapshot {
  dscr: number;
  currentRatio: number;
  debtToEquity: number;
  leverage: number;
  exposure: number;
  revenueChangePercentage: number;
}

function requireBorrower(borrowerId: string): Borrower {
  const borrower = getBorrowerById(borrowerId);

  if (!borrower) {
    throw new ToolInputError(`Borrower not found: ${borrowerId}`);
  }

  return borrower;
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

export function getBorrowerProfile(borrowerId: string): Borrower {
  return structuredClone(requireBorrower(borrowerId));
}

export function getFacilities(borrowerId: string): CreditFacility[] {
  return structuredClone(requireBorrower(borrowerId).facilities);
}

export function getFinancialStatements(
  borrowerId: string,
): FinancialStatement[] {
  return [
    structuredClone(requireBorrower(borrowerId).financialStatement),
  ];
}

export function calculateFinancialRatios(
  borrowerId: string,
): FinancialRatioSnapshot {
  const borrower = requireBorrower(borrowerId);
  const financials = borrower.financialStatement;

  if (financials.previousRevenue <= 0) {
    throw new ToolInputError(
      `Previous revenue must be positive for borrower: ${borrowerId}`,
    );
  }

  const exposure = borrower.facilities
    .filter((facility) => facility.status === "ACTIVE")
    .reduce(
      (total, facility) => total + facility.outstandingBalance,
      0,
    );

  return {
    dscr: calculateDSCR(
      financials.ebitda,
      financials.annualDebtService,
    ),
    currentRatio: calculateCurrentRatio(
      financials.currentAssets,
      financials.currentLiabilities,
    ),
    debtToEquity: calculateDebtToEquity(
      financials.totalDebt,
      financials.equity,
    ),
    leverage: calculateLeverageRatio(
      financials.totalDebt,
      financials.ebitda,
    ),
    exposure,
    revenueChangePercentage: round(
      ((financials.revenue - financials.previousRevenue) /
        financials.previousRevenue) *
        100,
    ),
  };
}

export function testCovenants(
  borrowerId: string,
): CovenantResult[] {
  const borrower = requireBorrower(borrowerId);
  const ratios = calculateFinancialRatios(borrowerId);

  const metricValues = {
    DSCR: ratios.dscr,
    CURRENT_RATIO: ratios.currentRatio,
    DEBT_TO_EQUITY: ratios.debtToEquity,
    LEVERAGE: ratios.leverage,
  };

  return borrower.covenants.map((rule) =>
    testCovenant(rule, metricValues[rule.metric]),
  );
}

export function identifyMissingDocuments(
  borrowerId: string,
): BorrowerDocument[] {
  const documents = requireBorrower(borrowerId).documents;

  return structuredClone(
    documents.filter(
      (document) =>
        document.status === "MISSING" ||
        document.status === "OVERDUE",
    ),
  );
}