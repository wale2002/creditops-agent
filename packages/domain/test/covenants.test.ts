import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type CovenantRule, testCovenant } from "../src/covenants.js";

const minimumDscrRule: CovenantRule = {
  id: "covenant-atlas-dscr",
  name: "Minimum DSCR",
  metric: "DSCR",
  direction: "minimum",
  threshold: 1.25,
  citation: {
    document: "Commercial Credit Policy",
    section: "5.3 — Debt Service Requirements",
  },
};

describe("covenant testing", () => {
  it("flags Atlas Manufacturing's DSCR breach", () => {
    const result = testCovenant(minimumDscrRule, 1.18);

    assert.equal(result.status, "BREACH");
    assert.equal(result.headroom, -0.07);
    assert.equal(result.citation.section, "5.3 — Debt Service Requirements");
  });

  it("passes a value exactly at the minimum", () => {
    const result = testCovenant(minimumDscrRule, 1.25);

    assert.equal(result.status, "PASS");
    assert.equal(result.headroom, 0);
  });

  it("supports maximum covenants", () => {
    const rule: CovenantRule = {
      id: "covenant-atlas-leverage",
      name: "Maximum Leverage",
      metric: "LEVERAGE",
      direction: "maximum",
      threshold: 3,
      citation: {
        document: "Covenant Monitoring Policy",
        section: "2.1 — Leverage Limits",
      },
    };

    const result = testCovenant(rule, 2.93);

    assert.equal(result.status, "PASS");
    assert.equal(result.headroom, 0.07);
  });
});
