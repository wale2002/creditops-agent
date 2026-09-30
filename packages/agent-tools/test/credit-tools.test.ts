import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateFinancialRatios,
  getBorrowerProfile,
  identifyMissingDocuments,
  testCovenants,
  ToolInputError,
} from "../src/credit-tools.js";

describe("credit analyst tools", () => {
  it("calculates Atlas Manufacturing's financial ratios", () => {
    const ratios = calculateFinancialRatios(
      "atlas-manufacturing",
    );

    assert.deepEqual(ratios, {
      dscr: 1.18,
      currentRatio: 1.53,
      debtToEquity: 1.38,
      leverage: 2.93,
      exposure: 180_000_000,
      revenueChangePercentage: -14.78,
    });
  });

  it("detects Atlas Manufacturing's DSCR breach", () => {
    const results = testCovenants("atlas-manufacturing");

    const dscrResult = results.find(
      (result) => result.covenantId === "atlas-minimum-dscr",
    );

    assert.equal(dscrResult?.status, "BREACH");
    assert.equal(dscrResult?.actual, 1.18);
    assert.equal(dscrResult?.threshold, 1.25);
  });

  it("identifies overdue documents", () => {
    const documents = identifyMissingDocuments(
      "atlas-manufacturing",
    );

    assert.equal(documents.length, 1);
    assert.equal(documents[0]?.name, "2026 management accounts");
    assert.equal(documents[0]?.status, "OVERDUE");
  });

  it("returns cloned records that cannot mutate source data", () => {
    const firstResult = getBorrowerProfile("atlas-manufacturing");
    firstResult.name = "Changed by caller";

    const secondResult = getBorrowerProfile("atlas-manufacturing");

    assert.equal(secondResult.name, "Atlas Manufacturing Ltd");
  });

  it("rejects an unknown borrower", () => {
    assert.throws(
      () => calculateFinancialRatios("unknown-borrower"),
      ToolInputError,
    );
  });
});