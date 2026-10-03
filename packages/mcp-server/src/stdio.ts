import { serveStdio } from "@modelcontextprotocol/server/stdio";

import {
  createCreditOpsMcpServer,
  readMcpIdentity,
} from "./server.js";

const identity = readMcpIdentity();

void serveStdio(
  () =>
    createCreditOpsMcpServer({
      actorId: identity.actorId,
      role: identity.role,
    }).server,
);

console.error(
  `CreditOps MCP server ready on stdio as ${identity.actorId} (${identity.role})`,
);
