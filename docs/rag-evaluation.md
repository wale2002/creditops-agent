# CreditOps RAG evaluation

CreditOps evaluates policy retrieval before allowing the feature to be treated
as portfolio-ready. The benchmark is deterministic and does not invoke Amazon
Bedrock or consume AWS credits.

## Run the evaluation

```powershell
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run eval:policy --workspace @creditops/agent-tools
```

## Metrics

- **Status accuracy:** answered and insufficient-evidence classifications.
- **Retrieval hit rate:** expected policy section appears in retrieved evidence.
- **Top-1 accuracy:** expected policy section is ranked first.
- **Citation validity:** returned text and citation metadata match the corpus.
- **Safe-refusal accuracy:** unrelated questions return no fabricated evidence.

The initial benchmark contains six answerable policy questions and two
unanswerable control questions. Every metric currently has a 100% threshold.
The corpus and benchmark are synthetic and intended for portfolio evaluation,
not real lending decisions.
