function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event, context) {
  const path = event?.rawPath ?? event?.requestContext?.http?.path ?? "/";

  if (path === "/health") {
    return response(200, {
      service: "creditops-api",
      status: "healthy",
      dataMode: process.env.CREDITOPS_DATA_MODE ?? "UNKNOWN",
      requestId: context.awsRequestId,
    });
  }

  return response(501, {
    error: "NOT_IMPLEMENTED",
    message:
      "The CDK milestone provisions the secure API boundary only. Application handlers are connected in a later milestone.",
    requestId: context.awsRequestId,
  });
}
