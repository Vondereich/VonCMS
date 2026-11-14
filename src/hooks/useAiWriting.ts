import { useCallback, useState } from 'react';
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
  settings?: import('../types').SiteSettings;
  parseJsonResponse: (
    res: Response,
    actionLabel: string
  ) => Promise<import('../types').ContentEditorResponse>;
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

const resolveAiModel = (settings?: import('../types').SiteSettings) => {
  const configuredModel =
    settings?.aiAssistant?.model?.trim() || settings?.api?.aiModel?.trim() || '';
  return configuredModel.startsWith('gemini-') ? configuredModel : 'gemini-3.6-flash';
};

export const useAiWriting = ({ settings, parseJsonResponse }: UseAiWritingOptions) => {
  const [mode, setMode] = useState<AiAssistantMode>('write');
  const [writePrompt, setWritePrompt] = useState('');
  const [pendingResult, setPendingResult] = useState<AiAssistantResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [credentialSource, setCredentialSource] = useState<'auto' | 'personal' | 'shared'>('auto');

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
          },
          body: JSON.stringify({
            topic,
            context,
            model,
          }),
        });

        const data = await parseJsonResponse(res, 'AI generation');
        if (data.credentialSource === 'personal' || data.credentialSource === 'shared')
          setCredentialSource(data.credentialSource);
        setResultFromText('write', data.text || '', data.model || model);
      } catch (err) {
        notify.error(
          'AI Generation Failed: ' + (err instanceof Error ? err.message : 'Unknown error')
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [parseJsonResponse, setResultFromText, settings, writePrompt]
  );

  const onCheck = useCallback(
    async ({ content }: { content: string }) => {
      if (!content.trim()) {
        notify.error('Please add some content first to check.');
        return;
      }

      setMode('check');
      setPendingResult(null);
      setIsChecking(true);

      try {
        const model = resolveAiModel(settings);
        const res = await vonFetch(API.aiCheck, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: content,
            model,
          }),
        });

        const data = await parseJsonResponse(res, 'AI check');
        if (data.credentialSource === 'personal' || data.credentialSource === 'shared')
          setCredentialSource(data.credentialSource);
        setResultFromText('check', data.text || '', data.model || model);
      } catch (err) {
        notify.error('AI Check Failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setIsChecking(false);
      }
    },
    [parseJsonResponse, setResultFromText, settings]
  );

  const clearPendingResult = useCallback(() => {
    setPendingResult(null);
  }, []);

  return {
    activeModel: resolveAiModel(settings),
    credentialSource,
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
