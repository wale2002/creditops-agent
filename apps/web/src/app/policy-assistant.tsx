"use client";

import { useState, type FormEvent } from "react";

interface PolicyEvidence {
  chunkId: string;
  content: string;
  score: number;
  citation: {
    document: string;
    section: string;
    version: string;
    effectiveDate: string;
  };
}

interface PolicyAnswer {
  status: "ANSWERED" | "INSUFFICIENT_EVIDENCE";
  mode: "EXTRACTIVE_RAG";
  answer: string;
  grounded: boolean;
  evidence: PolicyEvidence[];
}

const suggestedQuestions = [
  "What is the minimum DSCR requirement?",
  "Who may approve credit or waive a covenant?",
  "What is the maximum leverage requirement?",
];

export function PolicyAssistant() {
  const [question, setQuestion] = useState(suggestedQuestions[0]);
  const [response, setResponse] = useState<PolicyAnswer>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function askPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (question.trim().length < 3) {
      setError("Enter a policy question with at least three characters.");
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const result = await fetch("/api/policy-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const payload = (await result.json()) as PolicyAnswer | { error: string };

      if (!result.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Policy search failed");
      }

      setResponse(payload);
    } catch (caught) {
      setResponse(undefined);
      setError(
        caught instanceof Error
          ? caught.message
          : "The policy assistant could not complete the request.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-[#cfe0db] bg-white shadow-[0_12px_32px_rgba(24,55,48,0.06)]">
      <div className="grid gap-5 bg-[#143a34] px-5 py-5 text-white lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-[-0.025em]">Ask the policy assistant</h2>
            <span className="rounded-full bg-[#d8f4ed] px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#12604f]">
              OFFLINE RAG
            </span>
          </div>
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-[#bed7d1]">
            Ask about the synthetic commercial credit policy. Answers are extracted from retrieved evidence, not model memory.
          </p>
        </div>
        <div className="rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-[#d7ece7] ring-1 ring-white/15">
          No AWS request · No credit usage
        </div>
      </div>

      <div className="p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {suggestedQuestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setQuestion(suggestion)}
              className="rounded-full border border-[#d5e2de] bg-[#f6f9f8] px-3 py-1.5 text-xs font-medium text-[#4d6660] transition hover:border-[#9fc5ba] hover:bg-[#edf7f4] hover:text-[#176653]"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <form onSubmit={askPolicy} className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="policy-question" className="sr-only">
            Policy question
          </label>
          <input
            id="policy-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={500}
            placeholder="Ask a question about credit policy..."
            className="min-h-11 flex-1 rounded-xl border border-[#cfdcd8] bg-white px-4 text-sm text-[#243a35] outline-none transition placeholder:text-[#94a39f] focus:border-[#4e9b88] focus:ring-4 focus:ring-[#dff1ec]"
          />
          <button
            type="submit"
            disabled={loading}
            className="min-h-11 rounded-xl bg-[#0f6b5b] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0c594c] disabled:cursor-wait disabled:bg-[#709b91]"
          >
            {loading ? "Searching policy..." : "Retrieve answer"}
          </button>
        </form>

        {error ? (
          <p className="mt-4 rounded-xl border border-[#f0c7b7] bg-[#fff3ed] px-4 py-3 text-sm text-[#9e3f1d]">
            {error}
          </p>
        ) : null}

        {response ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_310px]">
            <div className={`rounded-xl border p-4 ${response.grounded ? "border-[#c8dfd8] bg-[#f5faf8]" : "border-[#edd5aa] bg-[#fffaf0]"}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#58716a]">
                  {response.grounded ? "Grounded answer" : "Insufficient evidence"}
                </p>
                <span className={`h-2.5 w-2.5 rounded-full ${response.grounded ? "bg-[#269071]" : "bg-[#d99b2b]"}`} />
              </div>
              <p className="whitespace-pre-line text-sm leading-6 text-[#29413b]">
                {response.answer}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#7b8c87]">
                Retrieved evidence ({response.evidence.length})
              </p>
              {response.evidence.length > 0 ? (
                response.evidence.map((item, index) => (
                  <div key={item.chunkId} className="rounded-xl border border-[#dce6e3] px-3.5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-semibold leading-5 text-[#29443d]">
                        {index + 1}. {item.citation.section}
                      </p>
                      <span className="rounded bg-[#edf4f2] px-1.5 py-0.5 font-mono text-[9px] text-[#58716a]">
                        score {item.score}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[10px] leading-4 text-[#788984]">
                      {item.citation.document} · v{item.citation.version}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-[#d9e2df] px-3 py-4 text-xs text-[#84938f]">
                  No matching policy sections were found.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-[#d5e2de] bg-[#fafcfb] px-4 py-5 text-center text-xs text-[#7b8c87]">
            Submit a question to see the answer and its supporting citations.
          </div>
        )}
      </div>
    </article>
  );
}
