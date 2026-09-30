export interface PolicyDocumentMetadata {
  documentId: string;
  title: string;
  version: string;
  effectiveDate: string;
}

export interface PolicyChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  version: string;
  effectiveDate: string;
  section: string;
  content: string;
}

export interface PolicySearchResult {
  chunkId: string;
  content: string;
  score: number;
  matchedTerms: string[];
  citation: {
    document: string;
    section: string;
    version: string;
    effectiveDate: string;
  };
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "for",
  "is",
  "of",
  "our",
  "the",
  "to",
  "what",
]);

const SYNONYMS: Record<string, readonly string[]> = {
  dscr: ["debt", "service", "coverage", "ratio"],
  liquidity: ["current", "ratio"],
};

function normalizeToken(token: string): string {
  if (token.endsWith("s") && token.length > 4) {
    return token.slice(0, -1);
  }

  return token;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function expandQuery(query: string): string[] {
  const terms = new Set<string>();

  for (const token of tokenize(query)) {
    terms.add(token);

    for (const synonym of SYNONYMS[token] ?? []) {
      terms.add(synonym);
    }
  }

  return [...terms];
}

function createChunkId(documentId: string, section: string): string {
  const normalizedSection = section
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${documentId}:${normalizedSection}`;
}

export function chunkPolicyDocument(
  markdown: string,
  metadata: PolicyDocumentMetadata,
): PolicyChunk[] {
  const chunks: PolicyChunk[] = [];
  const lines = markdown.split(/\r?\n/);

  let currentSection: string | undefined;
  let currentContent: string[] = [];

  function flushSection(): void {
    if (!currentSection) {
      currentContent = [];
      return;
    }

    const content = currentContent.join("\n").trim();

    if (content.length > 0) {
      chunks.push({
        id: createChunkId(metadata.documentId, currentSection),
        documentId: metadata.documentId,
        documentTitle: metadata.title,
        version: metadata.version,
        effectiveDate: metadata.effectiveDate,
        section: currentSection,
        content,
      });
    }

    currentContent = [];
  }

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);

    if (headingMatch) {
      flushSection();
      currentSection = headingMatch[1]?.trim();
      continue;
    }

    if (currentSection && line.trim().length > 0) {
      currentContent.push(line.trim());
    }
  }

  flushSection();

  return chunks;
}

export function searchCreditPolicy(
  query: string,
  chunks: readonly PolicyChunk[],
  limit = 3,
): PolicySearchResult[] {
  const queryTerms = expandQuery(query);

  if (queryTerms.length === 0 || limit <= 0) {
    return [];
  }

  return chunks
    .map((chunk) => {
      const sectionTerms = new Set(tokenize(chunk.section));
      const contentTerms = tokenize(chunk.content);
      const contentFrequency = new Map<string, number>();

      for (const term of contentTerms) {
        contentFrequency.set(term, (contentFrequency.get(term) ?? 0) + 1);
      }

      const matchedTerms: string[] = [];
      let score = 0;

      for (const term of queryTerms) {
        const headingMatch = sectionTerms.has(term);
        const bodyMatches = contentFrequency.get(term) ?? 0;

        if (headingMatch || bodyMatches > 0) {
          matchedTerms.push(term);
          score += headingMatch ? 4 : 0;
          score += Math.min(bodyMatches, 3);
        }
      }

      return {
        chunkId: chunk.id,
        content: chunk.content,
        score,
        matchedTerms,
        citation: {
          document: chunk.documentTitle,
          section: chunk.section,
          version: chunk.version,
          effectiveDate: chunk.effectiveDate,
        },
      };
    })
    .filter((result) => result.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.chunkId.localeCompare(right.chunkId),
    )
    .slice(0, limit);
}