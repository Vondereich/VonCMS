import { SummaryPoint } from './types';

/**
 * AI Summary Extractors
 * Intelligent NLP-based extraction using browser-native APIs.
 */

let domParser: DOMParser | null = null;
const MIN_SUMMARY_WORDS = 180;
const SHORT_ARTICLE_WORDS = 500;
const MEDIUM_ARTICLE_WORDS = 1000;

function getParser(): DOMParser {
  if (!domParser) domParser = new DOMParser();
  return domParser;
}

function normalizePointText(text: string): string {
  const trimmed = text
    .replace(/\u00A0/g, ' ')
    .replace(/^[\s\-*•]+/, '')
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
  if (/[:;,\-—…]\.?$/.test(normalized)) return false;

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
  parsedDoc
    .querySelectorAll('script, style, iframe, pre, code, table, figure, figcaption')
    .forEach((node) => node.remove());

  const rawText = parsedDoc.body.innerText || parsedDoc.body.textContent || '';
  const blocks = rawText
    .replace(/\u00A0/g, ' ')
    .split(/\n+/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((block) => (/[.!?]$/.test(block) ? block : `${block}.`));

  if (blocks.length === 0) return [];

  let sentences: string[] = [];

  // 1. Tokenization using Intl.Segmenter
  try {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
    sentences = blocks.flatMap((block) =>
      [...segmenter.segment(block)].map((s) => s.segment.trim()).filter((s) => s.length > 5)
    );
  } catch (e) {
    // Fallback: Basic Regex split
    sentences = blocks.flatMap((block) =>
      block
        .split(/[.!?]+(?:\s+|$)/)
        .map((s) => s.trim())
        .filter((s) => s.length > 5)
    );
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

  // Select the strongest distinct sentences, then restore article order.
  const selectedSentences: Array<{ text: string; score: number; index: number }> = [];
  const seenText = new Set<string>();

  for (const candidate of scoredSentences.sort((a, b) => b.score - a.score)) {
    const normalizedText = normalizePointText(candidate.text);
    const normalizedKey = normalizedText
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalizedKey || seenText.has(normalizedKey)) continue;

    const candidateWords = new Set(normalizedKey.split(' ').filter(Boolean));
    const duplicatesExistingPoint = selectedSentences.some((selected) => {
      const selectedWords = new Set(
        selected.text
          .toLocaleLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, '')
          .split(/\s+/)
          .filter(Boolean)
      );
      const shorterPointSize = Math.min(candidateWords.size, selectedWords.size);
      if (shorterPointSize < 4) return false;

      let sharedWords = 0;
      candidateWords.forEach((word) => {
        if (selectedWords.has(word)) sharedWords += 1;
      });
      return sharedWords / shorterPointSize >= 0.8;
    });

    if (duplicatesExistingPoint) continue;

    seenText.add(normalizedKey);
    selectedSentences.push({ ...candidate, text: normalizedText });
    if (selectedSentences.length >= count) break;
  }

  return selectedSentences
    .sort((a, b) => a.index - b.index)
    .map(({ text }) => ({ text, type: 'sentence' as const }));
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
 * Blends descriptive headings with ranked factual sentences.
 */
export function extractHybrid(
  html: string,
  count: number = 5,
  headingLimit: number = 3
): SummaryPoint[] {
  const headings = extractHeadings(html, Number.MAX_SAFE_INTEGER)
    .filter((heading) => isDescriptiveHeading(heading.text))
    .slice(0, count);
  const narrativeHtml = html.replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi, ' ');
  const sentences = extractSentences(narrativeHtml, count);

  if (headings.length === 0) return sentences;

  const maximumHeadingPoints = count > 1 ? Math.max(1, Math.min(headingLimit, count - 1)) : 1;
  const selectedHeadings = headings.slice(0, maximumHeadingPoints);
  const selectedHeadingText = new Set(
    selectedHeadings.map((heading) =>
      heading.text
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
  );
  const selectedSentences = sentences
    .filter((sentence) => {
      const sentenceKey = sentence.text
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
      return sentenceKey !== '' && !selectedHeadingText.has(sentenceKey);
    })
    .slice(0, Math.max(0, count - selectedHeadings.length));
  const remainingSlots = count - selectedHeadings.length - selectedSentences.length;
  const fallbackHeadings =
    remainingSlots > 0
      ? headings.slice(selectedHeadings.length, selectedHeadings.length + remainingSlots)
      : [];

  return [...selectedHeadings, ...selectedSentences, ...fallbackHeadings].slice(0, count);
}

/**
 * Main switch-board for extraction
 */
export function extractSummary(
  html: string,
  method: 'sentences' | 'headings' | 'hybrid',
  count: number = 5
): SummaryPoint[] {
  const parser = getParser();
  const parsedDoc = parser.parseFromString(html, 'text/html');
  parsedDoc
    .querySelectorAll('script, style, iframe, pre, code, table, figure, figcaption')
    .forEach((node) => node.remove());

  const visibleText = (parsedDoc.body.innerText || parsedDoc.body.textContent || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  let wordCount = 0;

  try {
    const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
    wordCount = [...wordSegmenter.segment(visibleText)].filter(
      (segment) => segment.isWordLike
    ).length;
  } catch (e) {
    wordCount = visibleText ? visibleText.split(/\s+/).filter(Boolean).length : 0;
  }

  if (wordCount < MIN_SUMMARY_WORDS) return [];

  const effectiveCount =
    wordCount < SHORT_ARTICLE_WORDS
      ? Math.min(count, 2)
      : wordCount < MEDIUM_ARTICLE_WORDS
        ? Math.min(count, 3)
        : count;

  switch (method) {
    case 'sentences':
      return extractSentences(html, effectiveCount);
    case 'headings':
      return extractHeadings(html, effectiveCount);
    case 'hybrid':
      return extractHybrid(html, effectiveCount);
    default:
      return extractHybrid(html, effectiveCount);
  }
}
