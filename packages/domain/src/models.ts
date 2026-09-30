import type { CovenantRule } from "./covenants.js";

export type Currency = "NGN";
export type RiskStatus = "STABLE" | "MODERATE" | "ELEVATED";
export type DocumentStatus = "CURRENT" | "DUE_SOON" | "OVERDUE" | "MISSING";

export interface FinancialStatement {
  id: string;
  periodEnd: string;
  currency: Currency;
  revenue: number;
  previousRevenue: number;
  ebitda: number;
  totalDebt: number;
  totalAssets: number;
  currentAssets: number;
  currentLiabilities: number;
  equity: number;
  annualDebtService: number;
}

export interface CreditFacility {
  id: string;
  type: "TERM_LOAN" | "OVERDRAFT" | "REVOLVING_CREDIT";
  currency: Currency;
  approvedLimit: number;
  outstandingBalance: number;
  maturityDate: string;
  status: "ACTIVE" | "CLOSED";
}

export interface BorrowerDocument {
  id: string;
  name: string;
  status: DocumentStatus;
  asOfDate?: string;
  dueDate?: string;
}

export interface Borrower {
  id: string;
  name: string;
  sector: string;
  relationshipManager: string;
  riskStatus: RiskStatus;
  financialStatement: FinancialStatement;
  facilities: CreditFacility[];
  covenants: CovenantRule[];
  documents: BorrowerDocument[];
}