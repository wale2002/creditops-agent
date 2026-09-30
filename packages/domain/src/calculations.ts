export class FinancialCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinancialCalculationError";
  }
}

function requireFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new FinancialCalculationError(`${label} must be a finite number`);
  }
}

function requireNonNegative(value: number, label: string): void {
  requireFinite(value, label);

  if (value < 0) {
    throw new FinancialCalculationError(`${label} cannot be negative`);
  }
}

function requirePositive(value: number, label: string): void {
  requireFinite(value, label);

  if (value <= 0) {
    throw new FinancialCalculationError(`${label} must be greater than zero`);
  }
}

function roundRatio(value: number): number {
  return Number(value.toFixed(2));
}

export function calculateDSCR(
  ebitda: number,
  annualDebtService: number,
): number {
  requireFinite(ebitda, "EBITDA");
  requirePositive(annualDebtService, "Annual debt service");

  return roundRatio(ebitda / annualDebtService);
}

export function calculateCurrentRatio(
  currentAssets: number,
  currentLiabilities: number,
): number {
  requireNonNegative(currentAssets, "Current assets");
  requirePositive(currentLiabilities, "Current liabilities");

  return roundRatio(currentAssets / currentLiabilities);
}

export function calculateDebtToEquity(
  totalDebt: number,
  equity: number,
): number {
  requireNonNegative(totalDebt, "Total debt");
  requirePositive(equity, "Equity");

  return roundRatio(totalDebt / equity);
}

export function calculateLeverageRatio(
  totalDebt: number,
  ebitda: number,
): number {
  requireNonNegative(totalDebt, "Total debt");
  requirePositive(ebitda, "EBITDA");

  return roundRatio(totalDebt / ebitda);
}
