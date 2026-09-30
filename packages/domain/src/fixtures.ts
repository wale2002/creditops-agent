import type { Borrower } from "./models.js";

const dscrPolicy = {
  document: "Commercial Credit Policy",
  section: "5.3 — Debt Service Requirements",
};

const leveragePolicy = {
  document: "Covenant Monitoring Policy",
  section: "2.1 — Leverage Limits",
};

const liquidityPolicy = {
  document: "SME Lending Guidelines",
  section: "4.2 — Minimum Liquidity",
};

export const borrowers: Borrower[] = [
  {
    id: "atlas-manufacturing",
    name: "Atlas Manufacturing Ltd",
    sector: "Industrial Manufacturing",
    relationshipManager: "Amara Okafor",
    riskStatus: "ELEVATED",
    financialStatement: {
      id: "atlas-fy2026",
      periodEnd: "2026-06-30",
      currency: "NGN",
      revenue: 640_000_000,
      previousRevenue: 751_000_000,
      ebitda: 92_000_000,
      totalDebt: 270_000_000,
      totalAssets: 580_000_000,
      currentAssets: 165_000_000,
      currentLiabilities: 108_000_000,
      equity: 195_000_000,
      annualDebtService: 78_000_000,
    },
    facilities: [
      {
        id: "atlas-term-loan",
        type: "TERM_LOAN",
        currency: "NGN",
        approvedLimit: 200_000_000,
        outstandingBalance: 150_000_000,
        maturityDate: "2029-06-30",
        status: "ACTIVE",
      },
      {
        id: "atlas-overdraft",
        type: "OVERDRAFT",
        currency: "NGN",
        approvedLimit: 50_000_000,
        outstandingBalance: 30_000_000,
        maturityDate: "2027-03-31",
        status: "ACTIVE",
      },
    ],
    covenants: [
      {
        id: "atlas-minimum-dscr",
        name: "Minimum DSCR",
        metric: "DSCR",
        direction: "minimum",
        threshold: 1.25,
        citation: dscrPolicy,
      },
      {
        id: "atlas-maximum-leverage",
        name: "Maximum Leverage",
        metric: "LEVERAGE",
        direction: "maximum",
        threshold: 3,
        citation: leveragePolicy,
      },
      {
        id: "atlas-minimum-current-ratio",
        name: "Minimum Current Ratio",
        metric: "CURRENT_RATIO",
        direction: "minimum",
        threshold: 1.2,
        citation: liquidityPolicy,
      },
    ],
    documents: [
      {
        id: "atlas-audited-statements",
        name: "Audited financial statements",
        status: "CURRENT",
        asOfDate: "2025-12-31",
      },
      {
        id: "atlas-management-accounts",
        name: "2026 management accounts",
        status: "OVERDUE",
        dueDate: "2026-08-31",
      },
    ],
  },
  {
    id: "northstar-logistics",
    name: "Northstar Logistics Ltd",
    sector: "Transportation and Logistics",
    relationshipManager: "Tunde Adebayo",
    riskStatus: "MODERATE",
    financialStatement: {
      id: "northstar-fy2026",
      periodEnd: "2026-06-30",
      currency: "NGN",
      revenue: 1_240_000_000,
      previousRevenue: 1_160_000_000,
      ebitda: 210_000_000,
      totalDebt: 420_000_000,
      totalAssets: 1_150_000_000,
      currentAssets: 310_000_000,
      currentLiabilities: 220_000_000,
      equity: 510_000_000,
      annualDebtService: 155_000_000,
    },
    facilities: [
      {
        id: "northstar-term-loan",
        type: "TERM_LOAN",
        currency: "NGN",
        approvedLimit: 300_000_000,
        outstandingBalance: 250_000_000,
        maturityDate: "2030-02-28",
        status: "ACTIVE",
      },
      {
        id: "northstar-revolver",
        type: "REVOLVING_CREDIT",
        currency: "NGN",
        approvedLimit: 100_000_000,
        outstandingBalance: 50_000_000,
        maturityDate: "2027-05-31",
        status: "ACTIVE",
      },
    ],
    covenants: [
      {
        id: "northstar-minimum-dscr",
        name: "Minimum DSCR",
        metric: "DSCR",
        direction: "minimum",
        threshold: 1.25,
        citation: dscrPolicy,
      },
      {
        id: "northstar-maximum-leverage",
        name: "Maximum Leverage",
        metric: "LEVERAGE",
        direction: "maximum",
        threshold: 3.25,
        citation: leveragePolicy,
      },
    ],
    documents: [
      {
        id: "northstar-audited-statements",
        name: "Audited financial statements",
        status: "OVERDUE",
        dueDate: "2026-09-15",
      },
      {
        id: "northstar-management-accounts",
        name: "2026 management accounts",
        status: "CURRENT",
        asOfDate: "2026-08-31",
      },
    ],
  },
  {
    id: "greenfield-foods",
    name: "Greenfield Foods Ltd",
    sector: "Food Processing",
    relationshipManager: "Ifeoma Nwosu",
    riskStatus: "STABLE",
    financialStatement: {
      id: "greenfield-fy2026",
      periodEnd: "2026-06-30",
      currency: "NGN",
      revenue: 890_000_000,
      previousRevenue: 820_000_000,
      ebitda: 148_000_000,
      totalDebt: 260_000_000,
      totalAssets: 720_000_000,
      currentAssets: 240_000_000,
      currentLiabilities: 145_000_000,
      equity: 360_000_000,
      annualDebtService: 95_000_000,
    },
    facilities: [
      {
        id: "greenfield-term-loan",
        type: "TERM_LOAN",
        currency: "NGN",
        approvedLimit: 180_000_000,
        outstandingBalance: 140_000_000,
        maturityDate: "2029-11-30",
        status: "ACTIVE",
      },
      {
        id: "greenfield-overdraft",
        type: "OVERDRAFT",
        currency: "NGN",
        approvedLimit: 60_000_000,
        outstandingBalance: 40_000_000,
        maturityDate: "2027-06-30",
        status: "ACTIVE",
      },
    ],
    covenants: [
      {
        id: "greenfield-minimum-dscr",
        name: "Minimum DSCR",
        metric: "DSCR",
        direction: "minimum",
        threshold: 1.25,
        citation: dscrPolicy,
      },
      {
        id: "greenfield-maximum-leverage",
        name: "Maximum Leverage",
        metric: "LEVERAGE",
        direction: "maximum",
        threshold: 3,
        citation: leveragePolicy,
      },
    ],
    documents: [
      {
        id: "greenfield-audited-statements",
        name: "Audited financial statements",
        status: "CURRENT",
        asOfDate: "2025-12-31",
      },
      {
        id: "greenfield-management-accounts",
        name: "2026 management accounts",
        status: "CURRENT",
        asOfDate: "2026-08-31",
      },
    ],
  },
];

export function getBorrowerById(id: string): Borrower | undefined {
  return borrowers.find((borrower) => borrower.id === id);
}