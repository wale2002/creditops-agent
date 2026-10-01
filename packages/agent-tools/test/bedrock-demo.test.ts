import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BedrockDemoConfigError,
  parseBedrockDemoConfig,
  validateLiveBedrockConfig,
} from "../src/bedrock-demo.js";

describe("Bedrock demo configuration", () => {
  it("defaults to a cost-safe dry run", () => {
    const config = parseBedrockDemoConfig([], {});

    assert.deepEqual(config, {
      live: false,
      help: false,
      borrowerId: "atlas-manufacturing",
    });
  });

  it("reads live configuration without reading credential secrets", () => {
    const config = parseBedrockDemoConfig(
      ["--live", "--borrower=greenfield-foods"],
      {
        AWS_REGION: "us-east-1",
        BEDROCK_MODEL_ID: "amazon.nova-lite-v1:0",
        AWS_SECRET_ACCESS_KEY: "must-not-be-read",
      },
    );

    assert.deepEqual(config, {
      live: true,
      help: false,
      borrowerId: "greenfield-foods",
      region: "us-east-1",
      modelId: "amazon.nova-lite-v1:0",
    });
  });

  it("rejects a live run without required Bedrock settings", () => {
    const config = parseBedrockDemoConfig(["--live"], {});

    assert.throws(
      () => validateLiveBedrockConfig(config),
      BedrockDemoConfigError,
    );
  });

  it("rejects unknown command-line options", () => {
    assert.throws(
      () => parseBedrockDemoConfig(["--spend-money"], {}),
      /Unknown command-line option/,
    );
  });
});
