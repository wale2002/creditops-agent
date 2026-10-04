import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";

import { CreditOpsStack } from "../src/creditops-stack.js";

function synthesize(options?: {
  enableBedrock?: boolean;
  bedrockModelId?: string;
}): Template {
  const app = new App();
  const stack = new CreditOpsStack(app, "CreditOpsTest", options);
  return Template.fromStack(stack);
}

describe("CreditOps AWS infrastructure", () => {
  it("creates private encrypted and retained policy storage", () => {
    const template = synthesize();

    template.hasResource("AWS::S3::Bucket", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
      Properties: Match.objectLike({
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: "AES256",
              },
            },
          ],
        },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
        VersioningConfiguration: {
          Status: "Enabled",
        },
      }),
    });

    template.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: "Deny",
            Action: "s3:*",
            Condition: {
              Bool: {
                "aws:SecureTransport": "false",
              },
            },
          }),
        ]),
      },
    });
  });

  it("creates a bounded Node.js API compute layer", () => {
    const template = synthesize();

    template.resourceCountIs("AWS::Lambda::Function", 1);
    template.hasResourceProperties("AWS::Lambda::Function", {
      Architectures: ["arm64"],
      MemorySize: 256,
      ReservedConcurrentExecutions: 2,
      Runtime: "nodejs22.x",
      Timeout: 15,
      TracingConfig: {
        Mode: "Active",
      },
      Environment: {
        Variables: Match.objectLike({
          CREDITOPS_DATA_MODE: "SYNTHETIC",
        }),
      },
    });

    const policies = template.findResources("AWS::IAM::Policy");
    const serializedPolicies = JSON.stringify(policies);
    assert.match(serializedPolicies, /s3:GetObject/);
    assert.doesNotMatch(serializedPolicies, /s3:PutObject/);
  });

  it("creates a throttled HTTP API with retained access logs", () => {
    const template = synthesize();

    template.resourceCountIs("AWS::ApiGatewayV2::Api", 1);
    template.resourceCountIs("AWS::ApiGatewayV2::Integration", 1);
    template.resourceCountIs("AWS::ApiGatewayV2::Route", 2);
    template.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
      AutoDeploy: true,
      StageName: "$default",
      DefaultRouteSettings: {
        DetailedMetricsEnabled: true,
        ThrottlingBurstLimit: 5,
        ThrottlingRateLimit: 2,
      },
      AccessLogSettings: Match.objectLike({
        DestinationArn: Match.anyValue(),
        Format: Match.anyValue(),
      }),
    });

    template.resourceCountIs("AWS::Logs::LogGroup", 2);
    template.allResources("AWS::Logs::LogGroup", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
      Properties: Match.objectLike({
        RetentionInDays: 30,
      }),
    });
  });

  it("adds alarms and an operations dashboard", () => {
    const template = synthesize();

    template.resourceCountIs("AWS::CloudWatch::Alarm", 2);
    template.resourceCountIs("AWS::CloudWatch::Dashboard", 1);
    template.hasOutput("ApiEndpoint", {});
    template.hasOutput("PolicyBucketName", {});
  });

  it("has no Bedrock invocation permission by default", () => {
    const template = synthesize();
    const policies = template.findResources("AWS::IAM::Policy");

    assert.doesNotMatch(
      JSON.stringify(policies),
      /bedrock:InvokeModel/,
    );
  });

  it("grants one named Bedrock model only when explicitly enabled", () => {
    const template = synthesize({
      enableBedrock: true,
      bedrockModelId: "amazon.nova-lite-v1:0",
    });
    const policies = JSON.stringify(
      template.findResources("AWS::IAM::Policy"),
    );

    assert.match(policies, /bedrock:InvokeModel/);
    assert.match(policies, /foundation-model/);
    assert.match(policies, /amazon\.nova-lite-v1:0/);
    assert.doesNotMatch(
      policies,
      /"Action":"bedrock:InvokeModel","Effect":"Allow","Resource":"\*"/,
    );
  });

  it("rejects an enabled Bedrock integration without a model ID", () => {
    assert.throws(
      () => synthesize({ enableBedrock: true }),
      /bedrockModelId is required/,
    );
  });
});
