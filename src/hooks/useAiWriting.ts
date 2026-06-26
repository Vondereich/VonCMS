import { useCallback, useRef, useState } from 'react';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';
import { sanitizeEditorHtml } from '../utils/security';
import notify from '../utils/toast';

export type AiAssistantMode = 'write' | 'check';

export interface AiAssistantResult {
  mode: AiAssistantMode;
  html: string;
  plainText: string;
  model: string;
  generatedAt: string;
}

interface UseAiWritingOptions {
  settings?: any;
  parseJsonResponse: (res: Response, actionLabel: string) => Promise<any>;
}

const stripMarkdownCodeFences = (value: string) =>
  value
    .replace(/^```html/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim();

const toPlainText = (html: string) => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};

const resolveAiModel = (settings?: any) => {
  const configuredModel = settings?.api?.aiModel?.trim() || '';
  return configuredModel.startsWith('gemini-') ? configuredModel : 'gemini-flash-latest';
};

const isProtectedAiKey = (value?: string) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  return (
    !normalized ||
    normalized === '********' ||
    normalized.includes('********') ||
    normalized.includes('protected')
  );
};

export const useAiWriting = ({ settings, parseJsonResponse }: UseAiWritingOptions) => {
  const [mode, setMode] = useState<AiAssistantMode>('write');
  const [writePrompt, setWritePrompt] = useState('');
  const [pendingResult, setPendingResult] = useState<AiAssistantResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const promptedApiKeyRef = useRef('');

  const resolveApiKey = useCallback(
    (targetMode: AiAssistantMode) => {
      const hasUsableSavedAiKey = Boolean(
        settings?.api?.aiApiKey && !isProtectedAiKey(settings?.api?.aiApiKey)
      );
      const aiKeyExpiresAt = settings?.api?.aiKeyExpiresAt?.trim();
      const aiKeyExpiresAtTime = aiKeyExpiresAt ? Date.parse(aiKeyExpiresAt) : Number.NaN;
      const savedAiKeyExpired = Boolean(
        hasUsableSavedAiKey &&
        settings?.api?.expireAiKeyAfter30Days &&
        aiKeyExpiresAt &&
        (!Number.isFinite(aiKeyExpiresAtTime) || aiKeyExpiresAtTime <= Date.now())
      );

      let apiKey = savedAiKeyExpired || !hasUsableSavedAiKey ? '' : settings?.api?.aiApiKey?.trim();

      if (!apiKey && promptedApiKeyRef.current) {
        return promptedApiKeyRef.current;
      }

      if (savedAiKeyExpired) {
        notify.error('Saved Gemini API key expired. Enter a fresh key to continue.');
      }

      if (!apiKey) {
        const promptedApiKey =
          (targetMode === 'write'
            ? prompt('Please enter your Google Gemini API Key to generate content:')
            : prompt('Please enter your Gemini API Key for AI Grammar Check:')
          )?.trim() || '';

        apiKey = promptedApiKey;

        if (promptedApiKey) {
          promptedApiKeyRef.current = promptedApiKey;
        }
      }

      return apiKey;
    },
    [settings]
  );

  const setResultFromText = useCallback(
    (targetMode: AiAssistantMode, rawText: string, model: string) => {
      const cleanedHtml = sanitizeEditorHtml(stripMarkdownCodeFences(rawText || ''));
      const plainText = toPlainText(cleanedHtml);

      if (!cleanedHtml.trim()) {
        notify.error('AI returned empty content after cleanup. Please try again.');
        return false;
      }

      setPendingResult({
        mode: targetMode,
        html: cleanedHtml,
        plainText,
        model,
        generatedAt: new Date().toISOString(),
      });

      notify.success(
        targetMode === 'write'
          ? 'AI draft ready. Review it before applying.'
          : 'AI review ready. Apply it when satisfied.'
      );

      return true;
    },
    []
  );

  const onGenerate = useCallback(
    async ({ title, content }: { title: string; content: string }) => {
      const topic = writePrompt.trim() || title.trim();
      if (!topic) {
        notify.error('Please enter a title or prompt first to guide the AI.');
        return;
      }

      const apiKey = resolveApiKey('write');
      if (!apiKey) return;

      setMode('write');
      setPendingResult(null);
      setIsGenerating(true);

      try {
        const model = resolveAiModel(settings);
        const context = toPlainText(content).slice(0, 1600);
        const res = await vonFetch(API.aiGenerate, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gemini-key': apiKey,
          },
          body: JSON.stringify({
            topic,
            context,
            model,
          }),
        });

        const data = await parseJsonResponse(res, 'AI generation');
        setResultFromText('write', data.text || '', model);
      } catch (err: any) {
        notify.error('AI Generation Failed: ' + err.message);
      } finally {
        setIsGenerating(false);
      }
    },
    [parseJsonResponse, resolveApiKey, setResultFromText, settings, writePrompt]
  );

  const onCheck = useCallback(
    async ({ content }: { content: string }) => {
      if (!content.trim()) {
        notify.error('Please add some content first to check.');
        return;
      }

      const apiKey = resolveApiKey('check');
      if (!apiKey) return;

      setMode('check');
      setPendingResult(null);
      setIsChecking(true);

      try {
        const model = resolveAiModel(settings);
        const res = await vonFetch(API.aiCheck, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gemini-key': apiKey,
          },
          body: JSON.stringify({
            text: content,
            model,
          }),
        });

        const data = await parseJsonResponse(res, 'AI check');
        setResultFromText('check', data.text || '', model);
      } catch (err: any) {
        notify.error('AI Check Failed: ' + err.message);
      } finally {
        setIsChecking(false);
      }
    },
    [parseJsonResponse, resolveApiKey, setResultFromText, settings]
  );

  const clearPendingResult = useCallback(() => {
    setPendingResult(null);
  }, []);

  return {
    mode,
    setMode,
    writePrompt,
    setWritePrompt,
    pendingResult,
    isGenerating,
    isChecking,
    onGenerate,
    onCheck,
    clearPendingResult,
  };
};
