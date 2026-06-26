import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';

// Client-side wrapper: forward AI requests to server API to avoid bundling server SDK into browser builds.
export const generateBlogContent = async (
  topic: string,
  context: string = '',
  apiKey?: string,
  model?: string
): Promise<string> => {
  try {
    const res = await vonFetch(API.aiGenerate, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'x-gemini-key': apiKey }),
      },
      body: JSON.stringify({ topic, context, model }),
    });
    if (!res.ok) return `<p><em>AI service unavailable.</em></p>`;
    const json = await res.json();
    return json?.text || `<p><em>No content generated.</em></p>`;
  } catch (e) {
    return `<p><em>AI request failed.</em></p>`;
  }
};

export const checkGrammar = async (
  text: string,
  apiKey?: string,
  model?: string
): Promise<string> => {
  try {
    const res = await vonFetch(API.aiCheck, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'x-gemini-key': apiKey }),
      },
      body: JSON.stringify({ text, model }),
    });
    if (!res.ok) return text;
    const json = await res.json();
    return json?.text || text;
  } catch (e) {
    return text;
  }
};
