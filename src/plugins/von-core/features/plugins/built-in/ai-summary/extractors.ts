import { SummaryPoint } from './types';

/**
 * AI Summary Extractors
 * Intelligent NLP-based extraction using browser-native APIs.
 */

let domParser: DOMParser | null = null;
function getParser(): DOMParser {
  if (!domParser) domParser = new DOMParser();
  return domParser;
}

function normalizePointText(text: string): string {
  const trimmed = text
    .replace(/\u00A0/g, ' ')
    .replace(/^[\s\-*�]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!trimmed) return '';

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function isDescriptiveHeading(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return false;

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount < 5) return false;
  if (normalized.length < 32) return false;
  if (/[:;,\-��]$/.test(normalized)) return false;

  return true;
}

/**
 * Method 1: Smart Sentence Extraction
 * Uses LAIR (Language-Agnostic Intelligent Ranking) to find the most relevant points.
 */
export function extractSentences(
  html: string,
  count: number = 5,
  minChars: number = 25
): SummaryPoint[] {
  const parser = getParser();

  // Inject newlines for block elements to ensure clean text separation
  const cleanHtml = html.replace(/<\/(p|div|h[1-6]|li|br)>/gi, '$&\n');
  const parsedDoc = parser.parseFromString(cleanHtml, 'text/html');

  const rawText = parsedDoc.body.innerText || parsedDoc.body.textContent || '';
  const text = rawText.replace(/\s+/g, ' ').trim();

  if (!text) return [];

  let sentences: string[] = [];

  // 1. Tokenization using Intl.Segmenter
  try {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
    const segments = segmenter.segment(text);
    sentences = [...segments].map((s) => s.segment.trim()).filter((s) => s.length > 5);
  } catch (e) {
    // Fallback: Basic Regex split
    sentences = text
      .split(/[.!?]+(?:\s+|$)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);
  }

  if (sentences.length === 0) return [];

  // 2. Intelligence: Scoring & Ranking
  // Calculate Global Word Frequency for Dynamic Filler Detection
  const wordFreq: Record<string, number> = {};
  const allWords: string[][] = [];

  try {
    const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
    sentences.forEach((s) => {
      const words = [...wordSegmenter.segment(s)]
        .filter((seg) => seg.isWordLike)
        .map((seg) => seg.segment.toLowerCase());
      allWords.push(words);
      words.forEach((w) => {
        wordFreq[w] = (wordFreq[w] || 0) + 1;
      });
    });
  } catch (e) {
    // Fallback word tokenizer
    sentences.forEach((s) => {
      const words = s.toLowerCase().split(/\W+/).filter(Boolean);
      allWords.push(words);
      words.forEach((w) => {
        wordFreq[w] = (wordFreq[w] || 0) + 1;
      });
    });
  }

  // Identify "Fillers" (words that appear in too many sentences)
  const fillerThreshold = Math.max(2, sentences.length * 0.4);
  const fillers = new Set(
    Object.keys(wordFreq).filter((w) => wordFreq[w] > fillerThreshold || w.length < 3)
  );

  // Score sentences
  const scoredSentences = sentences.map((original, i) => {
    const words = allWords[i] || [];
    if (words.length === 0) return { text: original, score: 0, index: i };

    // Density of non-filler words
    const keywords = words.filter((w) => !fillers.has(w));
    let score = keywords.length / words.length;

    // Positional Boosting
    if (i === 0) score += 1.5; // Strong Intro Bias
    if (i === sentences.length - 1) score += 1.0; // Strong Conclusion Bias
    if (i < 3) score += 0.5; // Lead-in bias

    // Length Penalty/Bonus (prefer medium-long sentences, ignore snippets)
    if (original.length < minChars) score -= 2.0;
    if (original.length > 250) score -= 0.5; // Penalize run-on sentences

    return { text: original, score, index: i };
  });

  // Sort by score and take top N
  const topSentences = scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    // Re-sort by original index to maintain chronological flow
    .sort((a, b) => a.index - b.index);

  return topSentences
    .map((s) => normalizePointText(s.text))
    .filter(Boolean)
    .map((text) => ({
      text,
      type: 'sentence' as const,
    }));
}

/**
 * Method 2: Heading Extraction
 * Extracts h2, h3, and h4 tags.
 */
export function extractHeadings(html: string, count: number = 5): SummaryPoint[] {
  // Include h4 for better coverage of detailed articles
  const headingRegex = /<h[234][^>]*>(.*?)<\/h[234]>/gi;
  const matches = html.match(headingRegex);

  if (!matches) return [];

  const parser = getParser();
  const headings = matches
    .map((h) => {
      const parsedDoc = parser.parseFromString(h, 'text/html');
      return normalizePointText(
        (parsedDoc.body.innerText || parsedDoc.body.textContent || '').trim()
      );
    })
    .filter((h) => h.length > 0);

  return headings.slice(0, count).map((text) => ({
    text,
    type: 'heading' as const,
  }));
}

/**
 * Method 3: Hybrid (Smart)
 * Prioritizes headings only when they are descriptive enough to stand alone.
 */
export function extractHybrid(
  html: string,
  count: number = 5,
  headingThreshold: number = 3
): SummaryPoint[] {
  const headings = extractHeadings(html, count).filter((heading) =>
    isDescriptiveHeading(heading.text)
  );

  if (headings.length >= headingThreshold) {
    return headings;
  }

  return extractSentences(html, count);
}

/**
 * Main switch-board for extraction
 */
export function extractSummary(
  html: string,
  method: 'sentences' | 'headings' | 'hybrid',
  count: number = 5
): SummaryPoint[] {
  switch (method) {
    case 'sentences':
      return extractSentences(html, count);
    case 'headings':
      return extractHeadings(html, count);
    case 'hybrid':
      return extractHybrid(html, count);
    default:
      return extractHybrid(html, count);
  }
}
