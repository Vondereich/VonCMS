export interface SEOAnalysisResult {
  score: number;
  checks: {
    titleLength: { status: 'good' | 'warning' | 'bad'; message: string };
    contentLength: { status: 'good' | 'warning' | 'bad'; message: string };
    metaDescLength: { status: 'good' | 'warning' | 'bad'; message: string };
    keywordInTitle: { status: 'good' | 'warning' | 'bad'; message: string };
    keywordInDesc: { status: 'good' | 'warning' | 'bad'; message: string };
    keywordInContent: { status: 'good' | 'warning' | 'bad'; message: string };
    headings: { status: 'good' | 'warning' | 'bad'; message: string };
    images: { status: 'good' | 'warning' | 'bad'; message: string };
  };
}

const MAX_KEYWORD_CONTENT_CHARS = 200000;
const MAX_KEYWORD_TITLE_CHARS = 10000;
const MAX_ANALYZE_CONTENT_CHARS = 200000;
const MAX_ANALYZE_TITLE_CHARS = 10000;
const MAX_ANALYZE_DESC_CHARS = 20000;
const MAX_ANALYZE_KEYWORDS_CHARS = 20000;

const getSeoVisibleText = (html: string) => {
  const spacedHtml = (html || '')
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, ' ');

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(spacedHtml, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  }

  return spacedHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const extractKeywords = (content: string, title: string = ''): string[] => {
  const safeContent = (content || '').slice(0, MAX_KEYWORD_CONTENT_CHARS);
  const safeTitle = (title || '').slice(0, MAX_KEYWORD_TITLE_CHARS);
  if (!safeContent) return [];

  // English-only stopwords (web lingua franca)
  // Other languages handled algorithmically via length filter + frequency threshold
  const stopWords = new Set([
    'the',
    'and',
    'or',
    'but',
    'is',
    'are',
    'was',
    'were',
    'of',
    'in',
    'on',
    'to',
    'for',
    'with',
    'by',
    'at',
    'an',
    'a',
    'this',
    'that',
    'these',
    'those',
    'it',
    'its',
    'from',
    'as',
    'be',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'shall',
    'should',
    'can',
    'could',
    'may',
    'might',
    'must',
    'not',
    'no',
    'been',
    'being',
    'than',
    'then',
    'also',
    'into',
    'more',
    'some',
    'such',
    'only',
    'other',
    'very',
    'just',
    'about',
    'over',
    'after',
    'before',
    'now',
  ]);

  // =====================
  // 0. STATISTICAL STOPWORD DETECTION (truly language-agnostic)
  // Words spread across >60% of paragraphs are likely function words
  // Catches: "yang" (Malay), "है" (Hindi), "的" (Chinese), etc.
  // =====================
  const paragraphs = safeContent
    .replace(/<[^>]*>/g, '\n') // HTML tags → newlines
    .split(/\n{2,}|\r\n{2,}/) // Split by double newlines (paragraphs)
    .map((p) => p.trim())
    .filter((p) => p.length > 20); // Only meaningful paragraphs

  if (paragraphs.length >= 3) {
    // Need at least 3 paragraphs for statistical relevance
    const wordParagraphCount: Record<string, number> = {};

    for (const para of paragraphs) {
      const paraWords = new Set(
        para
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter((w) => w.length >= 4)
      );
      for (const w of paraWords) {
        wordParagraphCount[w] = (wordParagraphCount[w] || 0) + 1;
      }
    }

    // Words in >60% of paragraphs = auto-detected stopwords
    const threshold = paragraphs.length * 0.6;
    for (const [word, count] of Object.entries(wordParagraphCount)) {
      if (count > threshold) {
        stopWords.add(word);
      }
    }
  }

  // Strip HTML but keep original text for proper noun detection
  const rawText = safeContent
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const rawTitle = safeTitle.trim();

  // =====================
  // 1. PROPER NOUN DETECTION (language-agnostic)
  // Scan original casing — capitalized/uppercase words = important
  // =====================
  const properNouns = new Set<string>();
  const properNounRegex = /\b([A-Z][a-zA-Z]{2,})\b/g;
  const allCapsRegex = /\b([A-Z]{2,})\b/g;

  // Detect ALL-CAPS terms (OPEC, WTI, USD, etc.)
  let match;
  while ((match = allCapsRegex.exec(rawText)) !== null) {
    if (match[1].length >= 2) properNouns.add(match[1]);
  }
  while ((match = allCapsRegex.exec(rawTitle)) !== null) {
    if (match[1].length >= 2) properNouns.add(match[1]);
  }

  // Detect Capitalized words mid-sentence (not at sentence start)
  const sentences = rawText.split(/[.!?]\s+/);
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/);
    // Skip first word (sentence start is always capitalized)
    for (let i = 1; i < words.length; i++) {
      const word = words[i].replace(/[^a-zA-Z]/g, '');
      if (word.length >= 3 && properNounRegex.test(word)) {
        properNouns.add(word);
      }
      properNounRegex.lastIndex = 0; // Reset regex state
    }
  }

  // =====================
  // 2. BIGRAM EXTRACTION (language-agnostic)
  // 2-word phrases appearing ≥ 2 times = meaningful compound terms
  // =====================
  const bigramFreq: Record<string, number> = {};
  const cleanWords = rawText
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  for (let i = 0; i < cleanWords.length - 1; i++) {
    const bigram = cleanWords[i].toLowerCase() + ' ' + cleanWords[i + 1].toLowerCase();
    if (
      !stopWords.has(cleanWords[i].toLowerCase()) &&
      !stopWords.has(cleanWords[i + 1].toLowerCase())
    ) {
      bigramFreq[bigram] = (bigramFreq[bigram] || 0) + 1;
    }
  }

  // Keep bigrams that appear ≥ 2 times
  const significantBigrams = Object.entries(bigramFreq)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([bigram]) => bigram);

  // =====================
  // 3. SINGLE WORD FREQUENCY (with threshold ≥ 2)
  // =====================
  const cleanTitle = safeTitle.toLowerCase().replace(/[^\w\s]/g, '');
  const cleanContent = rawText.toLowerCase().replace(/[^\w\s]/g, '');

  const titleWords = cleanTitle.split(/\s+/).filter((w) => w.length >= 4 && !stopWords.has(w));
  const contentWords = cleanContent.split(/\s+/).filter((w) => w.length >= 4 && !stopWords.has(w));

  const frequency: Record<string, number> = {};

  // Title words get 5x weight
  titleWords.forEach((w) => {
    frequency[w] = (frequency[w] || 0) + 5;
  });

  contentWords.forEach((w) => {
    frequency[w] = (frequency[w] || 0) + 1;
  });

  // Boost proper nouns by +3
  properNouns.forEach((pn) => {
    const lower = pn.toLowerCase();
    frequency[lower] = (frequency[lower] || 0) + 3;
  });

  // Filter: must appear ≥ 2 times (or be a title/proper noun word)
  const singleKeywords = Object.entries(frequency)
    .filter(([word, count]) => count >= 2 && !stopWords.has(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);

  // =====================
  // 4. MERGE & DEDUPLICATE
  // Priority: Bigrams first, then proper nouns, then frequency words
  // =====================
  const result: string[] = [];
  const seen = new Set<string>();

  // Add bigrams first (most valuable — "Timur Tengah", "harga minyak")
  for (const bg of significantBigrams) {
    if (result.length >= 8) break;
    result.push(bg);
    // Mark component words as seen to avoid duplication
    bg.split(' ').forEach((w) => seen.add(w));
  }

  // Add proper nouns (OPEC, WTI, etc.)
  for (const pn of properNouns) {
    if (result.length >= 8) break;
    const lower = pn.toLowerCase();
    if (!seen.has(lower) && !stopWords.has(lower) && pn.length >= 3) {
      result.push(pn);
      seen.add(lower);
    }
  }

  // Fill remaining with frequency-based keywords
  for (const kw of singleKeywords) {
    if (result.length >= 8) break;
    if (!seen.has(kw)) {
      result.push(kw);
      seen.add(kw);
    }
  }

  return result;
};

export const analyzeSEO = (
  title: string,
  metaDescription: string,
  content: string,
  keywordsString: string
): SEOAnalysisResult => {
  let score = 0;
  // Initialize result with default values
  const result: SEOAnalysisResult = {
    score: 0,
    checks: {
      titleLength: { status: 'bad', message: 'Title is missing' },
      contentLength: { status: 'bad', message: 'Content is missing' },
      metaDescLength: { status: 'bad', message: 'Meta description is missing' },
      keywordInTitle: { status: 'bad', message: 'Title keyword is missing' },
      keywordInDesc: { status: 'bad', message: 'Meta keyword is missing' },
      keywordInContent: { status: 'bad', message: 'Content keyword is missing' },
      headings: { status: 'bad', message: 'No subheadings found' },
      images: { status: 'bad', message: 'No images found' },
    },
  };

  const safeTitle = (title || '').slice(0, MAX_ANALYZE_TITLE_CHARS);
  const safeMetaDescription = (metaDescription || '').slice(0, MAX_ANALYZE_DESC_CHARS);
  const safeContent = (content || '').slice(0, MAX_ANALYZE_CONTENT_CHARS);
  const safeKeywordsString = (keywordsString || '').slice(0, MAX_ANALYZE_KEYWORDS_CHARS);

  const visibleText = getSeoVisibleText(safeContent);
  const wordCount = visibleText ? visibleText.split(/\s+/).length : 0;
  const hasAnySeoInput = Boolean(
    safeTitle.trim() || safeMetaDescription.trim() || visibleText || safeKeywordsString.trim()
  );
  const keywords = safeKeywordsString
    ? safeKeywordsString
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k)
    : [];
  const lowerTitle = safeTitle.toLowerCase();
  const lowerDesc = safeMetaDescription.toLowerCase();
  const lowerContent = visibleText.toLowerCase();

  if (!hasAnySeoInput) {
    return result;
  }

  // 1. Title Length (Optimal: 40-60 chars)
  if (safeTitle.length >= 40 && safeTitle.length <= 60) {
    score += 15;
    result.checks.titleLength = {
      status: 'good',
      message: 'Title length is optimal (40-60 chars).',
    };
  } else if (safeTitle.length > 10 && safeTitle.length < 40) {
    score += 8;
    result.checks.titleLength = {
      status: 'warning',
      message: 'Title is a bit short. Aim for 40-60 chars.',
    };
  } else if (safeTitle.length > 60) {
    score += 8;
    result.checks.titleLength = {
      status: 'warning',
      message: 'Title is too long. Try to keep it under 60 chars.',
    };
  } else {
    result.checks.titleLength = { status: 'bad', message: 'Title is too short or missing.' };
  }

  // 2. Meta Description Length (Optimal: 120-160 chars)
  if (safeMetaDescription.length >= 120 && safeMetaDescription.length <= 160) {
    score += 15;
    result.checks.metaDescLength = {
      status: 'good',
      message: 'Meta description length is optimal.',
    };
  } else if (safeMetaDescription.length > 0) {
    score += 7;
    result.checks.metaDescLength = {
      status: 'warning',
      message: 'Meta description should be 120-160 chars.',
    };
  }

  // 3. Focus Keywords
  if (keywords.length > 0) {
    // In Title
    const inTitle = keywords.some((k) => lowerTitle.includes(k));
    if (inTitle) {
      score += 15;
      result.checks.keywordInTitle = { status: 'good', message: 'Focus keyword appears in title.' };
    } else {
      result.checks.keywordInTitle = {
        status: 'bad',
        message: 'Include a focus keyword in your title.',
      };
    }

    // In Description
    const inDesc = keywords.some((k) => lowerDesc.includes(k));
    if (inDesc) {
      score += 10;
      result.checks.keywordInDesc = {
        status: 'good',
        message: 'Focus keyword appears in meta description.',
      };
    } else {
      result.checks.keywordInDesc = {
        status: 'warning',
        message: 'Include a focus keyword in meta description.',
      };
    }

    // In Content
    const inContent = keywords.some((k) => lowerContent.includes(k));
    if (inContent) {
      score += 15;
      result.checks.keywordInContent = {
        status: 'good',
        message: 'Focus keyword appears in content.',
      };
    } else {
      result.checks.keywordInContent = {
        status: 'bad',
        message: 'Focus keyword missing from content.',
      };
    }
  }

  // 4. Content Length
  if (wordCount >= 300) {
    score += 15;
    result.checks.contentLength = {
      status: 'good',
      message: 'Content length is good (300+ words).',
    };
  } else if (wordCount >= 100) {
    score += 8;
    result.checks.contentLength = {
      status: 'warning',
      message: 'Content is a bit thin. Aim for 300+ words.',
    };
  } else {
    result.checks.contentLength = { status: 'bad', message: 'Content is too short.' };
  }

  // 5. Headings (H2, H3)
  const hasHeadings = /<h[2-3][\s>]/i.test(safeContent);
  if (hasHeadings) {
    score += 10;
    result.checks.headings = { status: 'good', message: 'Content is structured with subheadings.' };
  } else {
    result.checks.headings = { status: 'warning', message: 'Consider using H2 or H3 subheadings.' };
  }

  // 6. Images & Alt Text
  const imgCount = (safeContent.match(/<img\b/gi) || []).length;
  const altCount = (safeContent.match(/\salt=(["'])[^"']+\1/gi) || []).length;

  if (imgCount > 0) {
    if (altCount === imgCount) {
      score += 5;
      result.checks.images = { status: 'good', message: 'All images have alt text.' };
    } else {
      score += 3;
      result.checks.images = { status: 'warning', message: 'Some images are missing alt text.' };
    }
  } else {
    result.checks.images = {
      status: 'warning',
      message: 'Consider adding images to enrich content.',
    };
  }

  result.score = Math.min(100, score);
  return result;
};
