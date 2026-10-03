import { NextResponse } from "next/server";

import {
  borrowerOptions,
  getRelationshipReview,
} from "@/lib/review-data";

export async function GET(
  _request: Request,
  context: { params: Promise<{ borrowerId: string }> },
) {
  const { borrowerId } = await context.params;
  const exists = borrowerOptions.some((borrower) => borrower.id === borrowerId);

  if (!exists) {
    return NextResponse.json(
      { error: "Borrower not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(getRelationshipReview(borrowerId));
}
