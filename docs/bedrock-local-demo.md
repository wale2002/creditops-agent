# Local Amazon Bedrock demo

The CreditOps Bedrock runner is cost-safe by default. Without `--live`, it
prints a configuration preflight and does not send a request to AWS.

## 1. Run the local preflight

From the repository root:

```powershell
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run demo:bedrock --workspace @creditops/agent-tools
```

## 2. Configure non-secret settings

Copy `.env.example` to `.env` and select a Region and a model or inference
profile that is enabled in your AWS account. The `.env` file is ignored by
Git. Do not place long-lived access keys in the project.

The AWS SDK for JavaScript uses its standard credential provider chain. For
local development, prefer temporary credentials supplied through AWS IAM
Identity Center or a configured AWS profile.

## 3. Make an intentional live request

Only after authentication and Bedrock model access are configured:

```powershell
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run demo:bedrock --workspace @creditops/agent-tools -- --live
```

The live command may incur AWS charges. It prints the model's draft and an
audit summary, but it cannot approve credit or make a final lending decision.
