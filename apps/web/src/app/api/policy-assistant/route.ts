import { NextResponse } from "next/server";

import { getPolicyAnswer } from "@/lib/review-data";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("question" in body) ||
    typeof body.question !== "string"
  ) {
    return NextResponse.json(
      { error: "question must be a string" },
      { status: 400 },
    );
  }

  const question = body.question.trim();

  if (question.length < 3 || question.length > 500) {
    return NextResponse.json(
      { error: "question must be between 3 and 500 characters" },
      { status: 400 },
    );
  }

  return NextResponse.json(getPolicyAnswer(question));
}
