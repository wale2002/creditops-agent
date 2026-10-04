"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Decision = "APPROVED" | "REJECTED";

interface ApprovalState {
  borrowerId: string;
  reviewDigest: string;
  status: "AWAITING_HUMAN_REVIEW" | Decision;
  version: number;
  finalDecision: {
    eventId: string;
    decision: Decision;
    rationale: string;
    actorId: string;
    occurredAt: string;
    version: number;
    hash: string;
  } | null;
}

interface ReviewerIdentity {
  actorId: string;
  role: "CREDIT_OFFICER";
  source: "LOCAL_DEMO";
  enabled: boolean;
}

export function ReviewDecisionPanel({
  borrowerId,
  initialApproval,
  reviewer,
}: {
  borrowerId: string;
  initialApproval: ApprovalState;
  reviewer: ReviewerIdentity;
}) {
  const router = useRouter();
  const [approval, setApproval] = useState(initialApproval);
  const [rationale, setRationale] = useState("");
  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null);
  const [message, setMessage] = useState("");

  async function submitDecision(decision: Decision) {
    if (rationale.trim().length < 10) {
      setMessage("Enter a rationale of at least 10 characters.");
      return;
    }

    setPendingDecision(decision);
    setMessage("");

    try {
      const response = await fetch(`/api/reviews/${borrowerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          rationale,
          expectedVersion: approval.version,
        }),
      });
      const payload = (await response.json()) as {
        approval?: ApprovalState;
        error?: string;
      };

      if (!response.ok || !payload.approval) {
        throw new Error(payload.error ?? "The decision could not be recorded.");
      }

      setApproval(payload.approval);
      setRationale("");
      setMessage(
        `${payload.approval.status} was recorded in the tamper-evident decision log.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The decision could not be recorded.",
      );
    } finally {
      setPendingDecision(null);
    }
  }

  const decided = approval.finalDecision !== null;

  return (
    <article className="overflow-hidden rounded-2xl border border-[#c9ddd7] bg-white shadow-[0_12px_32px_rgba(24,55,48,0.06)]">
      <div className="border-b border-[#dce8e4] bg-[#f4faf8] px-5 py-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#548076]">
              Human decision checkpoint
            </p>
            <h2 className="mt-1 font-semibold tracking-[-0.02em] text-[#183b33]">
              Authorized credit-officer review
            </h2>
          </div>
          <span className="w-fit rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-[#315c52] ring-1 ring-[#c8ddd7]">
            {reviewer.source === "LOCAL_DEMO" ? "LOCAL DEMO IDENTITY" : reviewer.source}
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#e1e9e7] bg-[#fafcfb] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#84928f]">Reviewer</p>
            <p className="mt-1.5 text-sm font-semibold text-[#2d4841]">{reviewer.actorId}</p>
          </div>
          <div className="rounded-xl border border-[#e1e9e7] bg-[#fafcfb] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#84928f]">Enforced role</p>
            <p className="mt-1.5 text-sm font-semibold text-[#2d4841]">{reviewer.role}</p>
          </div>
          <div className="rounded-xl border border-[#e1e9e7] bg-[#fafcfb] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#84928f]">Review version</p>
            <p className="mt-1.5 text-sm font-semibold text-[#2d4841]">v{approval.version}</p>
          </div>
        </div>

        {decided ? (
          <div className={`mt-5 rounded-xl border p-4 ${approval.status === "APPROVED" ? "border-[#b9dfd4] bg-[#edf8f4]" : "border-[#efc8b8] bg-[#fff4ef]"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={`text-sm font-bold ${approval.status === "APPROVED" ? "text-[#176b57]" : "text-[#a94116]"}`}>
                FINAL DECISION: {approval.status}
              </p>
              <code className="text-[10px] text-[#657772]">
                {approval.finalDecision?.hash.slice(0, 12)}…
              </code>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#415b55]">
              {approval.finalDecision?.rationale}
            </p>
            <p className="mt-3 text-[11px] text-[#71817d]">
              Recorded by {approval.finalDecision?.actorId} at{" "}
              {approval.finalDecision
                ? new Date(approval.finalDecision.occurredAt).toLocaleString()
                : ""}
            </p>
          </div>
        ) : (
          <div className="mt-5">
            <label htmlFor="decision-rationale" className="text-sm font-semibold text-[#2a443d]">
              Decision rationale
            </label>
            <textarea
              id="decision-rationale"
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              minLength={10}
              maxLength={1000}
              rows={4}
              disabled={!reviewer.enabled || pendingDecision !== null}
              placeholder="Explain the evidence and conditions supporting the human decision…"
              className="mt-2 w-full resize-y rounded-xl border border-[#cbdad6] bg-white px-4 py-3 text-sm leading-6 text-[#243b35] outline-none transition placeholder:text-[#9aa8a4] focus:border-[#368a77] focus:ring-2 focus:ring-[#cde9e2] disabled:bg-[#f2f5f4]"
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => submitDecision("APPROVED")}
                disabled={!reviewer.enabled || pendingDecision !== null}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#176b57] px-5 text-sm font-semibold text-white transition hover:bg-[#125747] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pendingDecision === "APPROVED" ? "Recording…" : "Approve review"}
              </button>
              <button
                type="button"
                onClick={() => submitDecision("REJECTED")}
                disabled={!reviewer.enabled || pendingDecision !== null}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#d8aa96] bg-white px-5 text-sm font-semibold text-[#a2431d] transition hover:bg-[#fff5f0] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pendingDecision === "REJECTED" ? "Recording…" : "Reject review"}
              </button>
            </div>
          </div>
        )}

        {!reviewer.enabled && (
          <p className="mt-4 rounded-lg bg-[#fff8df] px-3 py-2 text-xs text-[#785b14]">
            Demo approvals are disabled in production until an authenticated identity adapter is configured.
          </p>
        )}
        <p aria-live="polite" className="mt-3 min-h-5 text-xs font-medium text-[#536b65]">
          {message}
        </p>
      </div>
    </article>
  );
}
