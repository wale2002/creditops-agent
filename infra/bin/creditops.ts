#!/usr/bin/env node

import { App } from "aws-cdk-lib";

import { CreditOpsStack } from "../src/creditops-stack.js";

const app = new App({
  outdir: "cdk.out",
});

const stack = new CreditOpsStack(app, "CreditOpsDevelopment");
const assembly = app.synth();

console.log(
  `Synthesized ${stack.stackName} to ${assembly.directory}. No AWS resources were deployed.`,
);
