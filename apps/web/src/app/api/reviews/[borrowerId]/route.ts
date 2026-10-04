import { NextResponse } from "next/server";

import {
  ApprovalPermissionError,
  DecisionConflictError,
  DecisionLogIntegrityError,
  type HumanDecision,
} from "@creditops/agent-tools";

import {
  DemoApprovalDisabledError,
  borrowerOptions,
  getLocalReviewerIdentity,
  getRelationshipReview,
  submitRelationshipDecision,
} from "@/lib/review-data";

export const dynamic = "force-dynamic";

function borrowerExists(borrowerId: string): boolean {
  return borrowerOptions.some((borrower) => borrower.id === borrowerId);
}

function errorResponse(error: unknown) {
  if (error instanceof DecisionConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  if (error instanceof ApprovalPermissionError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  if (error instanceof DemoApprovalDisabledError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  if (error instanceof TypeError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof DecisionLogIntegrityError) {
    return NextResponse.json(
      { error: "The decision audit log failed its integrity check" },
      { status: 500 },
    );
  }

  console.error("Unexpected review decision error", error);
  return NextResponse.json(
    { error: "The review decision could not be processed" },
    { status: 500 },
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ borrowerId: string }> },
) {
  const { borrowerId } = await context.params;

  if (!borrowerExists(borrowerId)) {
    return NextResponse.json(
      { error: "Borrower not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ...getRelationshipReview(borrowerId),
    reviewer: getLocalReviewerIdentity(),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ borrowerId: string }> },
) {
  const { borrowerId } = await context.params;

  if (!borrowerExists(borrowerId)) {
    return NextResponse.json(
      { error: "Borrower not found" },
      { status: 404 },
    );
  }

  try {
    const payload = (await request.json()) as unknown;

    if (typeof payload !== "object" || payload === null) {
      throw new TypeError("Request body must be a JSON object");
    }

    const input = payload as Record<string, unknown>;
    const decision = input.decision as HumanDecision;

    if (decision !== "APPROVED" && decision !== "REJECTED") {
      throw new TypeError("decision must be APPROVED or REJECTED");
    }

    if (typeof input.rationale !== "string") {
      throw new TypeError("rationale must be a string");
    }

    if (
      typeof input.expectedVersion !== "number" ||
      !Number.isInteger(input.expectedVersion)
    ) {
      throw new TypeError("expectedVersion must be an integer");
    }

    const approval = submitRelationshipDecision({
      borrowerId,
      decision,
      rationale: input.rationale,
      expectedVersion: Number(input.expectedVersion),
    });

    return NextResponse.json({ approval }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Request body must contain valid JSON" },
        { status: 400 },
      );
    }

    return errorResponse(error);
  }
}
