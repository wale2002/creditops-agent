# CreditOps MCP server

CreditOps provides a local Model Context Protocol server over stdio. It allows an MCP-compatible host to discover and call a deliberately small set of read-oriented commercial-credit tools.

The server uses the official MCP TypeScript SDK, the existing CreditOps role-based tool executor, and synthetic data only. It does not call Amazon Bedrock or any other AWS service.

## Tools

| Tool | Purpose |
| --- | --- |
| `creditops.get_relationship` | Retrieve a synthetic borrower relationship |
| `creditops.get_financial_statements` | Retrieve recorded financial statements |
| `creditops.search_credit_policy` | Retrieve relevant policy evidence and citations |
| `creditops.run_covenant_test` | Run deterministic covenant tests |
| `creditops.get_relationship_review` | Assemble an evidence-backed draft review |

Every tool is marked read-only, non-destructive, idempotent, and closed-world in its MCP annotations. The server does not expose approval, waiver, update, delete, or administrative tools.

## Build and test

From the repository root:

```powershell
npm run build --workspace @creditops/mcp-server
npm run test --workspace @creditops/mcp-server
```

To start the stdio server:

```powershell
npm run start --workspace @creditops/mcp-server
```

An stdio server waits for an MCP host on standard input. Its JSON-RPC protocol uses standard output, so operational messages are written only to standard error.

## Generic client configuration

Build the workspace, replace the placeholder with the absolute repository path, and adapt the outer configuration key to the MCP host you use:

```json
{
  "mcpServers": {
    "creditops": {
      "command": "node",
      "args": [
        "C:/ABSOLUTE/PATH/creditops-agent/packages/mcp-server/dist/stdio.js"
      ],
      "env": {
        "CREDITOPS_MCP_ACTOR_ID": "portfolio-demo-banker",
        "CREDITOPS_MCP_ROLE": "BANKER"
      }
    }
  }
}
```

Supported demonstration roles are `BANKER`, `CREDIT_OFFICER`, and `SYSTEM_MONITOR`. The existing application permissions still decide which underlying tools each role may execute.

## Trust and identity boundary

For local stdio, the MCP host launches the process and supplies the actor context through environment variables. This is identity propagation inside one local operating-system trust boundary; it is not remote user authentication.

A network deployment must not accept role names directly from callers. It should authenticate users with an identity provider, validate tokens at the gateway, derive roles from trusted claims, and pass a verified principal to the server. OAuth and tenant-level borrower entitlements are intentionally left for the future HTTP deployment.

## Audit behaviour

Each dispatched MCP call records:

- MCP event ID and correlation ID
- actor ID and role
- tool name and validated input
- success, error, or denial outcome
- IDs of the underlying CreditOps tool audit events
- a safe error message when execution fails

The MCP response includes its event and correlation IDs so an operator can trace it through both layers. These events are stored in memory in the portfolio version; production storage would be durable and tamper-evident.

Malformed calls rejected by the MCP SDK before handler dispatch do not enter the application audit log. A production gateway should capture protocol-level validation failures in its security telemetry.

## Human decision boundary

`creditops.get_relationship_review` returns a draft with:

```text
status: AWAITING_HUMAN_REVIEW
finalDecision: null
```

The MCP server cannot approve credit, waive a covenant, or change borrower data. Those capabilities are absent rather than relying on a model to remember a prompt restriction.
