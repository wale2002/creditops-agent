import Link from "next/link";

import {
  borrowerOptions,
  getPolicyEvaluation,
  getRelationshipReview,
} from "@/lib/review-data";
import { PolicyAssistant } from "./policy-assistant";

const money = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  notation: "compact",
  maximumFractionDigits: 1,
});

function statusTone(status: string): string {
  if (status === "BREACH" || status === "ELEVATED") {
    return "bg-[#fff0e8] text-[#a94116] ring-[#f2c2ad]";
  }

  if (status === "PASS" || status === "STABLE") {
    return "bg-[#e5f6ef] text-[#176b57] ring-[#b7dfd3]";
  }

  return "bg-[#eef3f6] text-[#4c6470] ring-[#d4e0e5]";
}

function Icon({ name }: { name: "shield" | "spark" | "file" | "check" }) {
  const paths = {
    shield: "M12 3 5 6v5c0 4.6 3 8 7 10 4-2 7-5.4 7-10V6l-7-3Z",
    spark: "m12 3 1.2 4.8L18 9l-4.8 1.2L12 15l-1.2-4.8L6 9l4.8-1.2L12 3Z",
    file: "M7 3h7l4 4v14H7V3Zm7 0v5h5M10 13h6M10 17h6",
    check: "m6 12 4 4 8-9",
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d={paths[name]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ borrower?: string }>;
}) {
  const query = await searchParams;
  const selectedBorrower = borrowerOptions.some(
    (borrower) => borrower.id === query.borrower,
  )
    ? query.borrower!
    : borrowerOptions[0]!.id;
  const { review, auditEvents } = getRelationshipReview(selectedBorrower);
  const policyEvaluation = getPolicyEvaluation();
  const borrower = borrowerOptions.find(
    (option) => option.id === selectedBorrower,
  )!;
  const breachedCovenants = review.covenantResults.filter(
    (covenant) => covenant.status === "BREACH",
  ).length;
  const ratioCards = [
    {
      label: "DSCR",
      value: `${review.ratios.dscr.toFixed(2)}x`,
      note: "Debt service coverage",
      alert: review.covenantResults.some(
        (item) => item.name === "Minimum DSCR" && item.status === "BREACH",
      ),
    },
    {
      label: "Leverage",
      value: `${review.ratios.leverage.toFixed(2)}x`,
      note: "Total debt / EBITDA",
      alert: review.covenantResults.some(
        (item) => item.name === "Maximum Leverage" && item.status === "BREACH",
      ),
    },
    {
      label: "Current ratio",
      value: `${review.ratios.currentRatio.toFixed(2)}x`,
      note: "Short-term liquidity",
      alert: review.covenantResults.some(
        (item) =>
          item.name === "Minimum Current Ratio" && item.status === "BREACH",
      ),
    },
    {
      label: "Exposure",
      value: money.format(review.exposure),
      note: `${review.facilityCount} active facilities`,
      alert: false,
    },
  ];

  return (
    <main className="min-h-screen bg-[#f4f7f6] text-[#14211f]">
      <div className="border-b border-[#dbe4e1] bg-[#102f2b] px-5 py-2 text-center text-xs font-medium tracking-wide text-[#d7f7ef]">
        SYNTHETIC PORTFOLIO DATA · DEMONSTRATION ENVIRONMENT · NO LENDING DECISIONS
      </div>

      <header className="border-b border-[#dbe4e1] bg-white px-5 py-4 lg:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0f6b5b] text-white shadow-sm">
              <Icon name="shield" />
            </span>
            <div>
              <p className="text-lg font-semibold tracking-[-0.03em]">CreditOps</p>
              <p className="text-xs text-[#6d7d79]">Commercial credit intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-[#edf7f4] px-3 py-1.5 text-xs font-medium text-[#176b57] ring-1 ring-[#c9e6de] sm:inline-flex">
              Offline controls active
            </span>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#e9efed] text-xs font-semibold text-[#36504a]">
              OA
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-6 p-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:p-8">
        <aside className="h-fit rounded-2xl border border-[#dbe4e1] bg-white p-3 shadow-[0_12px_30px_rgba(24,55,48,0.05)]">
          <div className="px-3 pb-3 pt-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#82918d]">
              Relationships
            </p>
          </div>
          <nav className="space-y-1.5" aria-label="Borrower relationships">
            {borrowerOptions.map((option) => {
              const active = option.id === selectedBorrower;

              return (
                <Link
                  key={option.id}
                  href={`/?borrower=${option.id}`}
                  className={`block rounded-xl px-3 py-3 transition ${
                    active
                      ? "bg-[#e9f5f1] ring-1 ring-[#c5e1d9]"
                      : "hover:bg-[#f5f8f7]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`text-sm font-semibold ${active ? "text-[#0e5b4d]" : "text-[#2b3b37]"}`}>
                        {option.name}
                      </p>
                      <p className="mt-1 text-xs text-[#7a8985]">{option.sector}</p>
                    </div>
                    <span
                      className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                        option.riskStatus === "ELEVATED"
                          ? "bg-[#d8642e]"
                          : option.riskStatus === "MODERATE"
                            ? "bg-[#d9a62e]"
                            : "bg-[#2d9a79]"
                      }`}
                    />
                  </div>
                </Link>
              );
            })}
          </nav>
          <div className="mx-3 my-4 border-t border-[#e5ecea]" />
          <div className="rounded-xl bg-[#142f2b] p-4 text-white">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-[#9ee3d3]">
              <Icon name="spark" />
            </div>
            <p className="text-sm font-semibold">Evidence-first AI</p>
            <p className="mt-1.5 text-xs leading-5 text-[#b7d0ca]">
              Calculations stay deterministic. Decisions stay human.
            </p>
          </div>
        </aside>

        <section className="min-w-0 space-y-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusTone(borrower.riskStatus)}`}>
                  {borrower.riskStatus} RISK
                </span>
                <span className="rounded-full bg-[#eef3f6] px-2.5 py-1 text-[11px] font-semibold text-[#53666f] ring-1 ring-[#d5e0e5]">
                  AWAITING HUMAN REVIEW
                </span>
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#14211f] md:text-4xl">
                {review.borrowerName}
              </h1>
              <p className="mt-2 text-sm text-[#6f7f7b]">
                Relationship review · Generated from controlled source records and policy evidence
              </p>
            </div>
            <a
              href={`/api/reviews/${selectedBorrower}`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#cbd9d5] bg-white px-4 text-sm font-semibold text-[#29443d] shadow-sm transition hover:border-[#9ebbb3] hover:bg-[#f8fbfa]"
            >
              <Icon name="file" />
              View review JSON
            </a>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {ratioCards.map((metric) => (
              <article
                key={metric.label}
                className="rounded-2xl border border-[#dce6e3] bg-white p-5 shadow-[0_10px_26px_rgba(24,55,48,0.045)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7a8985]">
                    {metric.label}
                  </p>
                  <span className={`h-2 w-2 rounded-full ${metric.alert ? "bg-[#d85f2b]" : "bg-[#2d9a79]"}`} />
                </div>
                <p className={`mt-4 text-2xl font-semibold tracking-[-0.04em] ${metric.alert ? "text-[#b8461d]" : "text-[#17332d]"}`}>
                  {metric.value}
                </p>
                <p className="mt-1.5 text-xs text-[#7a8985]">{metric.note}</p>
              </article>
            ))}
          </div>

          <PolicyAssistant />

          <article className="rounded-2xl border border-[#d8e5e1] bg-white p-5 shadow-[0_10px_26px_rgba(24,55,48,0.045)]">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold tracking-[-0.02em]">RAG evaluation gate</h2>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${policyEvaluation.passed ? "bg-[#e5f6ef] text-[#176b57] ring-[#b7dfd3]" : "bg-[#fff0e8] text-[#a94116] ring-[#f2c2ad]"}`}>
                    {policyEvaluation.passed ? "PASS" : "FAIL"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#7a8985]">
                  {policyEvaluation.totalCases} labelled questions · Measured offline · Zero model calls
                </p>
              </div>
              <code className="w-fit rounded-lg bg-[#f0f5f3] px-3 py-2 text-[10px] text-[#4f6862]">
                npm run eval:policy
              </code>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ["Status accuracy", policyEvaluation.metrics.statusAccuracy],
                ["Retrieval hit rate", policyEvaluation.metrics.retrievalHitRate],
                ["Top-1 accuracy", policyEvaluation.metrics.top1Accuracy],
                ["Citation validity", policyEvaluation.metrics.citationValidity],
                ["Safe refusals", policyEvaluation.metrics.safeRefusalAccuracy],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-[#e1e9e7] bg-[#fafcfb] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#82918d]">
                    {label}
                  </p>
                  <p className="mt-2 text-xl font-semibold tracking-[-0.035em] text-[#176b57]">
                    {(Number(value) * 100).toFixed(0)}%
                  </p>
                </div>
              ))}
            </div>
          </article>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
            <article className="rounded-2xl border border-[#dce6e3] bg-white shadow-[0_10px_26px_rgba(24,55,48,0.045)]">
              <div className="flex items-center justify-between border-b border-[#e5ecea] px-5 py-4">
                <div>
                  <h2 className="font-semibold tracking-[-0.02em]">Covenant monitoring</h2>
                  <p className="mt-1 text-xs text-[#7a8985]">Code-calculated against recorded thresholds</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${breachedCovenants > 0 ? statusTone("BREACH") : statusTone("PASS")}`}>
                  {breachedCovenants} breach{breachedCovenants === 1 ? "" : "es"}
                </span>
              </div>
              <div className="divide-y divide-[#edf1f0]">
                {review.covenantResults.map((covenant) => (
                  <div key={covenant.covenantId} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#253a35]">{covenant.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${statusTone(covenant.status)}`}>
                          {covenant.status}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-[#788783]">
                        {covenant.citation.document} · {covenant.citation.section}
                      </p>
                    </div>
                    <div className="flex gap-5 text-right">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#95a19e]">Actual</p>
                        <p className="mt-1 text-sm font-semibold">{covenant.actual.toFixed(2)}x</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#95a19e]">Threshold</p>
                        <p className="mt-1 text-sm font-semibold">{covenant.threshold.toFixed(2)}x</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-[#dce6e3] bg-white shadow-[0_10px_26px_rgba(24,55,48,0.045)]">
              <div className="border-b border-[#e5ecea] px-5 py-4">
                <h2 className="font-semibold tracking-[-0.02em]">Review findings</h2>
                <p className="mt-1 text-xs text-[#7a8985]">Exceptions requiring analyst attention</p>
              </div>
              <div className="space-y-3 p-4">
                {review.findings.map((finding) => (
                  <div key={finding.code} className="rounded-xl border border-[#e5ecea] bg-[#fafcfb] p-4">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${finding.severity === "HIGH" ? "bg-[#fff0e8] text-[#bd4b20]" : "bg-[#fff8df] text-[#946d10]"}`}>
                        <Icon name={finding.severity === "HIGH" ? "shield" : "file"} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-[#293d38]">{finding.title}</p>
                        <p className="mt-1 text-xs leading-5 text-[#71817d]">{finding.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-2xl border border-[#dce6e3] bg-white p-5 shadow-[0_10px_26px_rgba(24,55,48,0.045)]">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e6f4f0] text-[#17715e]">
                  <Icon name="file" />
                </span>
                <div>
                  <h2 className="font-semibold tracking-[-0.02em]">Policy evidence</h2>
                  <p className="text-xs text-[#7a8985]">Retrieved from the versioned policy corpus</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {review.policyEvidence.map((evidence) => (
                  <div key={evidence.chunkId} className="rounded-xl border border-[#dfe8e5] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#27423b]">{evidence.citation.section}</p>
                      <span className="rounded-md bg-[#eef5f3] px-2 py-1 font-mono text-[10px] text-[#4d6861]">
                        v{evidence.citation.version}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#6d7e79]">{evidence.content}</p>
                    <p className="mt-3 text-[11px] font-medium text-[#16705e]">{evidence.citation.document}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-[#dce6e3] bg-white p-5 shadow-[0_10px_26px_rgba(24,55,48,0.045)]">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e6f4f0] text-[#17715e]">
                  <Icon name="check" />
                </span>
                <div>
                  <h2 className="font-semibold tracking-[-0.02em]">Immutable audit trail</h2>
                  <p className="text-xs text-[#7a8985]">Every deterministic tool execution is recorded</p>
                </div>
              </div>
              <div className="mt-5 overflow-hidden rounded-xl border border-[#e1e9e7]">
                <div className="grid grid-cols-[1fr_auto] bg-[#f4f8f6] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#81908c]">
                  <span>Tool</span>
                  <span>Outcome</span>
                </div>
                <div className="divide-y divide-[#edf1f0]">
                  {auditEvents.map((event) => (
                    <div key={event.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3">
                      <div>
                        <p className="font-mono text-xs font-medium text-[#35534c]">{event.toolName}</p>
                        <p className="mt-1 text-[10px] text-[#96a19e]">{event.actorRole} · {event.resultCount ?? 0} result(s)</p>
                      </div>
                      <span className="rounded-full bg-[#e5f6ef] px-2 py-1 text-[10px] font-bold text-[#176b57] ring-1 ring-[#b7dfd3]">
                        {event.outcome}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>

          <footer className="flex flex-col justify-between gap-3 rounded-2xl bg-[#15352f] px-5 py-4 text-white sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold">Human decision boundary enforced</p>
              <p className="mt-1 text-xs text-[#b8d1cb]">CreditOps can prepare evidence. Only an authorized credit officer can decide.</p>
            </div>
            <span className="whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#d5eee8] ring-1 ring-white/15">
              finalDecision: null
            </span>
          </footer>
        </section>
      </div>
    </main>
  );
}
