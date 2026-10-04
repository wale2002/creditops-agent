import { fileURLToPath } from "node:url";

import {
  Arn,
  ArnFormat,
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  Tags,
  type StackProps,
} from "aws-cdk-lib";
import { AccessLogFormat } from "aws-cdk-lib/aws-apigateway";
import {
  HttpApi,
  HttpMethod,
  HttpStage,
  LogGroupLogDestination,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {
  Alarm,
  ComparisonOperator,
  Dashboard,
  GraphWidget,
  TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import {
  Architecture,
  Code,
  Function,
  LoggingFormat,
  Runtime,
  Tracing,
} from "aws-cdk-lib/aws-lambda";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
} from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

export interface CreditOpsStackProps extends StackProps {
  enableBedrock?: boolean;
  bedrockModelId?: string;
}

export class CreditOpsStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: CreditOpsStackProps = {},
  ) {
    super(scope, id, props);

    if (props.enableBedrock && !props.bedrockModelId?.trim()) {
      throw new Error(
        "bedrockModelId is required when enableBedrock is true",
      );
    }

    Tags.of(this).add("Project", "CreditOps");
    Tags.of(this).add("Environment", "development");
    Tags.of(this).add("DataClassification", "synthetic-only");

    const policyBucket = new Bucket(this, "PolicyDocuments", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: Duration.days(1),
          noncurrentVersionExpiration: Duration.days(90),
        },
      ],
    });

    const apiFunctionLogs = new LogGroup(this, "ApiFunctionLogs", {
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const environment: Record<string, string> = {
      POLICY_BUCKET_NAME: policyBucket.bucketName,
      CREDITOPS_DATA_MODE: "SYNTHETIC",
    };

    if (props.enableBedrock && props.bedrockModelId) {
      environment.BEDROCK_MODEL_ID = props.bedrockModelId;
    }

    const apiFunction = new Function(this, "CreditOpsApiFunction", {
      description:
        "CreditOps synthetic-data API boundary; final credit decisions remain human",
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      handler: "index.handler",
      code: Code.fromAsset(
        fileURLToPath(new URL("../lambda/api", import.meta.url)),
      ),
      memorySize: 256,
      timeout: Duration.seconds(15),
      reservedConcurrentExecutions: 2,
      tracing: Tracing.ACTIVE,
      loggingFormat: LoggingFormat.JSON,
      logGroup: apiFunctionLogs,
      environment,
    });

    policyBucket.grantRead(apiFunction, "policies/*");

    if (props.enableBedrock && props.bedrockModelId) {
      apiFunction.addToRolePolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["bedrock:InvokeModel"],
          resources: [
            Arn.format(
              {
                service: "bedrock",
                region: this.region,
                account: "",
                resource: "foundation-model",
                resourceName: props.bedrockModelId,
                arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
              },
              this,
            ),
          ],
        }),
      );
    }

    const api = new HttpApi(this, "CreditOpsHttpApi", {
      description: "CreditOps synthetic commercial-credit API",
      createDefaultStage: false,
    });
    const integration = new HttpLambdaIntegration(
      "CreditOpsApiIntegration",
      apiFunction,
    );

    api.addRoutes({
      path: "/",
      methods: [HttpMethod.ANY],
      integration,
    });
    api.addRoutes({
      path: "/{proxy+}",
      methods: [HttpMethod.ANY],
      integration,
    });

    const apiAccessLogs = new LogGroup(this, "ApiAccessLogs", {
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const stage = new HttpStage(this, "DefaultApiStage", {
      httpApi: api,
      stageName: "$default",
      autoDeploy: true,
      detailedMetricsEnabled: true,
      throttle: {
        burstLimit: 5,
        rateLimit: 2,
      },
      accessLogSettings: {
        destination: new LogGroupLogDestination(apiAccessLogs),
        format: AccessLogFormat.jsonWithStandardFields({
          caller: false,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: false,
        }),
      },
    });

    const functionErrors = new Alarm(this, "FunctionErrorAlarm", {
      alarmDescription: "CreditOps API Lambda reported an error",
      metric: apiFunction.metricErrors({
        period: Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator:
        ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    const apiServerErrors = new Alarm(this, "ApiServerErrorAlarm", {
      alarmDescription: "CreditOps API Gateway returned a 5xx response",
      metric: stage.metricServerError({
        period: Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator:
        ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    new Dashboard(this, "OperationsDashboard", {
      dashboardName: "CreditOps-Development",
      widgets: [
        [
          new GraphWidget({
            title: "API requests and server errors",
            left: [stage.metricCount()],
            right: [stage.metricServerError()],
          }),
        ],
        [
          new GraphWidget({
            title: "Lambda invocations and errors",
            left: [apiFunction.metricInvocations()],
            right: [apiFunction.metricErrors()],
          }),
        ],
      ],
    });

    new CfnOutput(this, "ApiEndpoint", {
      description: "CreditOps HTTP API endpoint",
      value: stage.url,
    });
    new CfnOutput(this, "PolicyBucketName", {
      description: "Private bucket for synthetic credit-policy documents",
      value: policyBucket.bucketName,
    });
    new CfnOutput(this, "FunctionErrorAlarmName", {
      value: functionErrors.alarmName,
    });
    new CfnOutput(this, "ApiServerErrorAlarmName", {
      value: apiServerErrors.alarmName,
    });
  }
}
