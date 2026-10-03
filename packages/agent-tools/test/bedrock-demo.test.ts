import assert from "node:assert/strict";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";

import {
  BedrockDemoConfigError,
  parseBedrockDemoConfig,
  resolveLocalEnvironmentPath,
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

  it("loads the repository environment before a workspace-local copy", () => {
    const repositoryRoot = resolve("fixture-repository");
    const workspaceDirectory = resolve(
      repositoryRoot,
      "packages",
      "agent-tools",
    );
    const moduleUrl = pathToFileURL(
      resolve(workspaceDirectory, "src", "bedrock-demo.ts"),
    ).href;
    const repositoryEnvironmentPath = resolve(repositoryRoot, ".env");
    const workspaceEnvironmentPath = resolve(workspaceDirectory, ".env");

    const environmentPath = resolveLocalEnvironmentPath(
      workspaceDirectory,
      moduleUrl,
      (candidate) =>
        candidate === repositoryEnvironmentPath ||
        candidate === workspaceEnvironmentPath,
    );

    assert.equal(environmentPath, repositoryEnvironmentPath);
  });
});
