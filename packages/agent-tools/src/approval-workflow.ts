import { createHash, randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import { dirname } from "node:path";

import type { DraftRelationshipReview } from "./relationship-review.js";

export type HumanDecision = "APPROVED" | "REJECTED";
export type ApprovalActorRole =
  | "BANKER"
  | "CREDIT_OFFICER"
  | "AI_AGENT"
  | "SYSTEM_MONITOR";

export interface HumanDecisionEvent {
  eventId: string;
  borrowerId: string;
  reviewDigest: string;
  decision: HumanDecision;
  rationale: string;
  actorId: string;
  actorRole: "CREDIT_OFFICER";
  occurredAt: string;
  version: number;
  previousHash: string | null;
  hash: string;
}

export interface ReviewApprovalState {
  borrowerId: string;
  reviewDigest: string;
  status: "AWAITING_HUMAN_REVIEW" | HumanDecision;
  version: number;
  finalDecision: HumanDecisionEvent | null;
}

export interface SubmitHumanDecisionCommand {
  borrowerId: string;
  reviewDigest: string;
  decision: HumanDecision;
  rationale: string;
  actorId: string;
  actorRole: ApprovalActorRole;
  expectedVersion: number;
}

export interface ReviewDecisionStore {
  readAll(): HumanDecisionEvent[];
  append(event: HumanDecisionEvent): void;
}

export class ApprovalPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalPermissionError";
  }
}

export class DecisionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecisionConflictError";
  }
}

export class DecisionLogIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecisionLogIntegrityError";
  }
}

type UnsignedDecisionEvent = Omit<HumanDecisionEvent, "hash">;

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }

  return normalized;
}

function calculateEventHash(event: UnsignedDecisionEvent): string {
  return createHash("sha256").update(JSON.stringify(event)).digest("hex");
}

function validateEventShape(
  value: unknown,
  lineNumber: number,
): HumanDecisionEvent {
  if (typeof value !== "object" || value === null) {
    throw new DecisionLogIntegrityError(
      `Decision event on line ${lineNumber} is not an object`,
    );
  }

  const event = value as Record<string, unknown>;
  const stringFields = [
    "eventId",
    "borrowerId",
    "reviewDigest",
    "rationale",
    "actorId",
    "occurredAt",
    "hash",
  ];

  for (const field of stringFields) {
    if (typeof event[field] !== "string" || event[field].length === 0) {
      throw new DecisionLogIntegrityError(
        `Decision event on line ${lineNumber} has an invalid ${field}`,
      );
    }
  }

  if (event.decision !== "APPROVED" && event.decision !== "REJECTED") {
    throw new DecisionLogIntegrityError(
      `Decision event on line ${lineNumber} has an invalid decision`,
    );
  }

  if (event.actorRole !== "CREDIT_OFFICER") {
    throw new DecisionLogIntegrityError(
      `Decision event on line ${lineNumber} has an invalid actor role`,
    );
  }

  if (!Number.isInteger(event.version) || Number(event.version) < 1) {
    throw new DecisionLogIntegrityError(
      `Decision event on line ${lineNumber} has an invalid version`,
    );
  }

  if (event.previousHash !== null && typeof event.previousHash !== "string") {
    throw new DecisionLogIntegrityError(
      `Decision event on line ${lineNumber} has an invalid previous hash`,
    );
  }

  return event as unknown as HumanDecisionEvent;
}

function verifyEvents(events: readonly HumanDecisionEvent[]): void {
  const borrowerVersions = new Map<string, number>();
  let previousHash: string | null = null;

  events.forEach((event, index) => {
    const lineNumber = index + 1;
    const expectedVersion = (borrowerVersions.get(event.borrowerId) ?? 0) + 1;

    if (event.version !== expectedVersion) {
      throw new DecisionLogIntegrityError(
        `Decision event on line ${lineNumber} breaks the borrower version sequence`,
      );
    }

    if (event.previousHash !== previousHash) {
      throw new DecisionLogIntegrityError(
        `Decision event on line ${lineNumber} breaks the hash chain`,
      );
    }

    const { hash, ...unsignedEvent } = event;
    if (calculateEventHash(unsignedEvent) !== hash) {
      throw new DecisionLogIntegrityError(
        `Decision event on line ${lineNumber} failed its integrity check`,
      );
    }

    borrowerVersions.set(event.borrowerId, event.version);
    previousHash = event.hash;
  });
}

function validateAppend(
  events: readonly HumanDecisionEvent[],
  event: HumanDecisionEvent,
): void {
  verifyEvents(events);

  if (events.some((candidate) => candidate.eventId === event.eventId)) {
    throw new DecisionConflictError("Decision event ID already exists");
  }

  const latestGlobalEvent = events.at(-1);
  const latestBorrowerEvent = events
    .filter((candidate) => candidate.borrowerId === event.borrowerId)
    .at(-1);

  if (event.previousHash !== (latestGlobalEvent?.hash ?? null)) {
    throw new DecisionConflictError("Decision log changed before append");
  }

  if (event.version !== (latestBorrowerEvent?.version ?? 0) + 1) {
    throw new DecisionConflictError("Borrower decision version changed before append");
  }

  verifyEvents([...events, event]);
}

export class InMemoryReviewDecisionStore implements ReviewDecisionStore {
  private readonly events: HumanDecisionEvent[] = [];

  readAll(): HumanDecisionEvent[] {
    verifyEvents(this.events);
    return structuredClone(this.events);
  }

  append(event: HumanDecisionEvent): void {
    validateAppend(this.events, event);
    this.events.push(structuredClone(event));
  }
}

export class FileReviewDecisionStore implements ReviewDecisionStore {
  constructor(private readonly filePath: string) {}

  readAll(): HumanDecisionEvent[] {
    if (!existsSync(this.filePath)) {
      return [];
    }

    const lines = readFileSync(this.filePath, "utf8")
      .split(/\r?\n/u)
      .filter((line) => line.trim().length > 0);
    const events = lines.map((line, index) => {
      try {
        return validateEventShape(JSON.parse(line) as unknown, index + 1);
      } catch (error) {
        if (error instanceof DecisionLogIntegrityError) {
          throw error;
        }

        throw new DecisionLogIntegrityError(
          `Decision event on line ${index + 1} is not valid JSON`,
        );
      }
    });

    verifyEvents(events);
    return structuredClone(events);
  }

  append(event: HumanDecisionEvent): void {
    const events = this.readAll();
    validateAppend(events, event);
    mkdirSync(dirname(this.filePath), { recursive: true });
    appendFileSync(this.filePath, `${JSON.stringify(event)}\n`, "utf8");
  }
}

export function createReviewDigest(review: DraftRelationshipReview): string {
  return createHash("sha256")
    .update(JSON.stringify(review))
    .digest("hex");
}

export class ReviewApprovalService {
  constructor(
    private readonly store: ReviewDecisionStore,
    private readonly clock: () => Date = () => new Date(),
    private readonly idFactory: () => string = randomUUID,
  ) {}

  getState(borrowerId: string, reviewDigest: string): ReviewApprovalState {
    const normalizedBorrowerId = requireNonEmpty(borrowerId, "borrowerId");
    const normalizedDigest = requireNonEmpty(reviewDigest, "reviewDigest");
    const latestEvent = this.store
      .readAll()
      .filter((event) => event.borrowerId === normalizedBorrowerId)
      .at(-1);

    if (!latestEvent || latestEvent.reviewDigest !== normalizedDigest) {
      return {
        borrowerId: normalizedBorrowerId,
        reviewDigest: normalizedDigest,
        status: "AWAITING_HUMAN_REVIEW",
        version: latestEvent?.version ?? 0,
        finalDecision: null,
      };
    }

    return {
      borrowerId: normalizedBorrowerId,
      reviewDigest: normalizedDigest,
      status: latestEvent.decision,
      version: latestEvent.version,
      finalDecision: structuredClone(latestEvent),
    };
  }

  submitDecision(command: SubmitHumanDecisionCommand): ReviewApprovalState {
    const borrowerId = requireNonEmpty(command.borrowerId, "borrowerId");
    const reviewDigest = requireNonEmpty(command.reviewDigest, "reviewDigest");
    const actorId = requireNonEmpty(command.actorId, "actorId");
    const rationale = requireNonEmpty(command.rationale, "rationale");

    if (command.actorRole !== "CREDIT_OFFICER") {
      throw new ApprovalPermissionError(
        `${command.actorRole} cannot make a final credit decision`,
      );
    }

    if (command.decision !== "APPROVED" && command.decision !== "REJECTED") {
      throw new TypeError("decision must be APPROVED or REJECTED");
    }

    if (rationale.length < 10 || rationale.length > 1_000) {
      throw new TypeError("rationale must contain between 10 and 1000 characters");
    }

    if (!Number.isInteger(command.expectedVersion) || command.expectedVersion < 0) {
      throw new TypeError("expectedVersion must be a non-negative integer");
    }

    const events = this.store.readAll();
    const latestBorrowerEvent = events
      .filter((event) => event.borrowerId === borrowerId)
      .at(-1);
    const currentVersion = latestBorrowerEvent?.version ?? 0;

    if (command.expectedVersion !== currentVersion) {
      throw new DecisionConflictError(
        `Expected version ${command.expectedVersion}, but current version is ${currentVersion}`,
      );
    }

    if (latestBorrowerEvent?.reviewDigest === reviewDigest) {
      throw new DecisionConflictError(
        "This review already has a final human decision",
      );
    }

    const unsignedEvent: UnsignedDecisionEvent = {
      eventId: this.idFactory(),
      borrowerId,
      reviewDigest,
      decision: command.decision,
      rationale,
      actorId,
      actorRole: "CREDIT_OFFICER",
      occurredAt: this.clock().toISOString(),
      version: currentVersion + 1,
      previousHash: events.at(-1)?.hash ?? null,
    };
    const event: HumanDecisionEvent = {
      ...unsignedEvent,
      hash: calculateEventHash(unsignedEvent),
    };

    this.store.append(event);
    return this.getState(borrowerId, reviewDigest);
  }
}
